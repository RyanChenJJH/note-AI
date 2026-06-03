import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildMarkdown, writeExport } from '../src/exporter.ts';
import type { Round, SessionMeta } from '../src/types.ts';

const meta: SessionMeta = {
  id: 'claude:s1',
  source: 'claude',
  sessionId: 's1',
  title: '你可以做什么工作',
  startedAt: '2026-05-31T01:33:07.213Z',
  day: '2026-05-31',
  project: 'C:\\Users\\RyanC\\Desktop\\test',
};

const rounds: Round[] = [
  { index: 1, question: { id: 'r1-q', text: '你可以做什么工作', exported: false }, answer: { id: 'r1-a', text: '我可以协助编程', exported: false } },
  { index: 2, question: { id: 'r2-q', text: '问题二', exported: false }, answer: { id: 'r2-a', text: '回答二', exported: false } },
  { index: 3, question: { id: 'r3-q', text: '问题三', exported: false }, answer: { id: 'r3-a', text: '回答三正文', exported: false } },
];

test('buildMarkdown: front matter + only selected blocks, in round order', () => {
  const md = buildMarkdown(meta, rounds, ['r1-q', 'r1-a', 'r3-a'], {
    exportedAt: '2026-06-01T08:50:00+08:00',
  });

  // front matter
  assert.ok(md.startsWith('---\n'));
  assert.match(md, /title: "你可以做什么工作"/);
  assert.match(md, /source: claude/);
  assert.match(md, /session_id: "s1"/);
  assert.match(md, /date: 2026-05-31/);
  assert.match(md, /exported_at: 2026-06-01T08:50:00\+08:00/);
  assert.match(md, /rounds: \[1, 3\]/);
  assert.match(md, /tags: \[AI对话, claude\]/);

  // 选中块按轮升序、提问在回复前
  assert.match(md, /## 第 1 轮 · 提问\n\n你可以做什么工作/);
  assert.match(md, /## 第 1 轮 · 回复\n\n我可以协助编程/);
  assert.match(md, /## 第 3 轮 · 回复\n\n回答三正文/);

  // 未选中的块不得出现
  assert.doesNotMatch(md, /第 2 轮/);
  assert.doesNotMatch(md, /## 第 3 轮 · 提问/);
});

test('writeExport: sanitizes illegal chars, ensures .md, creates dir, avoids collision', (t) => {
  const dir = join(mkdtempSync(join(tmpdir(), 'aida-')), 'nested'); // 不存在 → 应自动创建
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  const p1 = writeExport('内容A', dir, 'a:b?c');
  assert.ok(p1.endsWith('a-b-c.md'));
  assert.equal(readFileSync(p1, 'utf8'), '内容A');

  const p2 = writeExport('内容B', dir, 'a:b?c'); // 同名 → 追加 (2)
  assert.ok(p2.endsWith('a-b-c (2).md'));
  assert.equal(readFileSync(p2, 'utf8'), '内容B');
});
