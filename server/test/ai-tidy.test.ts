import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { tidy } from '../src/ai/tidy.ts';
import type { TidyInput } from '../src/ai/tidy.ts';
import type { AiConfig, SessionMeta } from '../src/types.ts';

/** 临时最小 skill（内容无关，tidy 测试 mock 模型输出）。 */
function makeSkillDir(): string {
  const base = mkdtempSync(join(tmpdir(), 'aida-tidy-skill-'));
  mkdirSync(join(base, 'references', 'templates'), { recursive: true });
  writeFileSync(join(base, 'SKILL.md'), '# skill\n整理指令', 'utf8');
  return base;
}
const SKILL = makeSkillDir();
after(() => rmSync(SKILL, { recursive: true, force: true }));

const META: SessionMeta = {
  id: 'claude:s1',
  source: 'claude',
  sessionId: 's1',
  title: '聊聊 MCP',
  startedAt: '2026-05-28T03:00:00.000Z',
  day: '2026-05-28',
  project: 'E:/p',
};
const INPUT: TidyInput = {
  conversationMd: '---\ntitle: x\n---\n\n## 第 1 轮 · 提问\n\nMCP 是什么',
  meta: META,
  date: '2026-06-02',
};

function cfg(over: Partial<AiConfig> = {}): AiConfig {
  return {
    enabled: true,
    provider: 'openai-compatible',
    baseUrl: 'https://api.example.com/v1',
    apiKey: 'KEY',
    model: 'm',
    temperature: 0.3,
    timeoutMs: 60000,
    skillPath: SKILL,
    ...over,
  };
}

async function withFetch(
  impl: (url: string, init: RequestInit) => Promise<unknown>,
  fn: () => Promise<void>,
): Promise<void> {
  const orig = globalThis.fetch;
  globalThis.fetch = impl as unknown as typeof fetch;
  try {
    await fn();
  } finally {
    globalThis.fetch = orig;
  }
}

const reply = (content: string) => ({
  ok: true,
  status: 200,
  json: async () => ({ choices: [{ message: { content } }] }),
});

test('未开启 → degraded', async () => {
  const r = await tidy(INPUT, cfg({ enabled: false }));
  assert.equal(r.usedAi, false);
  assert.match(r.degraded ?? '', /未开启/);
});

test('缺 key → degraded', async () => {
  const r = await tidy(INPUT, cfg({ apiKey: '' }));
  assert.match(r.degraded ?? '', /API Key/);
});

test('skill 路径无效 → degraded（载入失败）', async () => {
  const r = await tidy(INPUT, cfg({ skillPath: join(SKILL, 'nope') }));
  assert.match(r.degraded ?? '', /载入 skill 失败/);
});

test('正常：多篇笔记 → usedAi:true，notes 解析', async () => {
  const out = [
    '<<<NOTE filename="20260602-概念-MCP原理.md">>>',
    '---',
    '标题: 概念-MCP原理',
    '---',
    '正文',
    '<<<END NOTE>>>',
    '',
    '<<<NOTE filename="b.md">>>',
    'BBB',
    '<<<END NOTE>>>',
  ].join('\n');
  await withFetch(
    async () => reply(out),
    async () => {
      const r = await tidy(INPUT, cfg());
      assert.equal(r.usedAi, true);
      assert.equal(r.notes.length, 2);
      assert.equal(r.notes[0].filename, '20260602-概念-MCP原理.md');
      assert.equal(r.degraded, undefined);
    },
  );
});

test('NO NOTES → usedAi:true，notes 空，带原因', async () => {
  await withFetch(
    async () => reply('<<<NO NOTES: 通篇项目执行，无普适知识>>>'),
    async () => {
      const r = await tidy(INPUT, cfg());
      assert.equal(r.usedAi, true);
      assert.equal(r.notes.length, 0);
      assert.match(r.noNotes ?? '', /项目执行/);
    },
  );
});

test('模型非 2xx → degraded（调用失败）', async () => {
  await withFetch(
    async () => ({ ok: false, status: 500, json: async () => ({ error: { message: '服务器忙' } }) }),
    async () => {
      const r = await tidy(INPUT, cfg());
      assert.equal(r.usedAi, false);
      assert.match(r.degraded ?? '', /调用失败/);
    },
  );
});

test('输出无法解析 → degraded', async () => {
  await withFetch(
    async () => reply('我先看一下你的需求……（没有哨兵块）'),
    async () => {
      const r = await tidy(INPUT, cfg());
      assert.match(r.degraded ?? '', /无法解析/);
    },
  );
});

test('超时（AbortError）→ degraded 超时', async () => {
  await withFetch(
    async () => {
      const e = new Error('aborted');
      e.name = 'AbortError';
      throw e;
    },
    async () => {
      const r = await tidy(INPUT, cfg());
      assert.match(r.degraded ?? '', /超时/);
    },
  );
});
