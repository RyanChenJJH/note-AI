import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getProvider } from '../src/ai/provider.ts';
import type { ChatMessage } from '../src/ai/provider.ts';
import type { AiConfig } from '../src/types.ts';

function cfg(over: Partial<AiConfig> = {}): AiConfig {
  return {
    enabled: true,
    provider: 'openai-compatible',
    baseUrl: 'https://api.example.com/v1',
    apiKey: 'KEY',
    model: 'm-test',
    temperature: 0.3,
    timeoutMs: 60000,
    skillPath: 'x',
    ...over,
  };
}

const MSGS: ChatMessage[] = [
  { role: 'system', content: 'sys' },
  { role: 'user', content: 'hi' },
];

/** 临时替换 globalThis.fetch，跑完恢复。 */
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

test('openai-compatible：成功解析 choices[0].message.content，组装正确 URL/头/body', async () => {
  let captured: { url: string; init: RequestInit } | undefined;
  await withFetch(
    async (url, init) => {
      captured = { url, init };
      return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: 'OUT' } }] }) };
    },
    async () => {
      const out = await getProvider('openai-compatible').chat(MSGS, cfg(), new AbortController().signal);
      assert.equal(out, 'OUT');
    },
  );
  assert.ok(captured);
  assert.equal(captured.url, 'https://api.example.com/v1/chat/completions');
  const headers = captured.init.headers as Record<string, string>;
  assert.equal(headers.Authorization, 'Bearer KEY');
  const body = JSON.parse(captured.init.body as string) as {
    model: string;
    stream: boolean;
    messages: ChatMessage[];
  };
  assert.equal(body.model, 'm-test');
  assert.equal(body.stream, false);
  assert.equal(body.messages.length, 2);
});

test('openai-compatible：baseUrl 末尾斜杠被规整', async () => {
  let url = '';
  await withFetch(
    async (u) => {
      url = u;
      return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: 'x' } }] }) };
    },
    async () => {
      await getProvider('openai-compatible').chat(MSGS, cfg({ baseUrl: 'https://h/v1/' }), new AbortController().signal);
    },
  );
  assert.equal(url, 'https://h/v1/chat/completions');
});

test('openai-compatible：非 2xx 抛错（含状态码与服务端原因）', async () => {
  await withFetch(
    async () => ({ ok: false, status: 401, json: async () => ({ error: { message: '鉴权失败' } }) }),
    async () => {
      await assert.rejects(
        () => getProvider('openai-compatible').chat(MSGS, cfg(), new AbortController().signal),
        /401.*鉴权失败/,
      );
    },
  );
});

test('openai-compatible：空内容抛错', async () => {
  await withFetch(
    async () => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: '  ' } }] }) }),
    async () => {
      await assert.rejects(
        () => getProvider('openai-compatible').chat(MSGS, cfg(), new AbortController().signal),
        /为空/,
      );
    },
  );
});

test('anthropic / ollama：暂未实现，调用即报错', async () => {
  await assert.rejects(
    () => getProvider('anthropic').chat(MSGS, cfg({ provider: 'anthropic' }), new AbortController().signal),
    /暂未实现/,
  );
  await assert.rejects(
    () => getProvider('ollama').chat(MSGS, cfg({ provider: 'ollama' }), new AbortController().signal),
    /暂未实现/,
  );
});
