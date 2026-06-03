import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { createApiServer } from '../src/http/server.ts';
import type { Deps } from '../src/http/server.ts';
import { filterByRange } from '../src/scanner.ts';
import type { Session } from '../src/types.ts';

const FIX = join(import.meta.dirname, 'fixtures');
const SCAN = join(FIX, 'scan');
const JSON_HEADERS = { 'Content-Type': 'application/json' };

function tmp(): string {
  return mkdtempSync(join(tmpdir(), 'aida-http-'));
}

/** 起服务于临时端口，跑完回调后关闭；返回前自动清理由调用方负责。 */
async function withServer(
  overrides: Partial<Deps>,
  fn: (base: string) => Promise<void>,
): Promise<void> {
  const server = createApiServer(overrides);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

/** 用真实 scan fixtures 作源 + 临时 manifest/config/导出目录。 */
function scanDeps(work: string): Partial<Deps> {
  return {
    claudeRoot: join(SCAN, 'claude'),
    codexRoot: join(SCAN, 'codex'),
    manifestPath: join(work, 'manifest.json'),
    configPath: join(work, 'config.json'),
    exportDir: join(work, 'exports'),
    aiNotesDir: join(work, 'ai-notes'),
  };
}

/** 写一个文件名含 sessionId 的 Claude 会话（resolveSessionPath 按文件名定位），含 thinking 块。 */
function writeClaudeFixture(work: string): string {
  const root = join(work, 'claude');
  const dir = join(root, 'projX');
  mkdirSync(dir, { recursive: true });
  const lines = [
    JSON.stringify({
      type: 'user',
      message: { role: 'user', content: '问A' },
      isSidechain: false,
      timestamp: '2026-05-28T03:00:00.000Z',
      cwd: 'E:\\p',
      sessionId: 'sess-http-1',
    }),
    JSON.stringify({
      type: 'assistant',
      message: {
        role: 'assistant',
        content: [
          { type: 'thinking', thinking: '内部推理XYZ' },
          { type: 'text', text: '答A' },
        ],
      },
      isSidechain: false,
      timestamp: '2026-05-28T03:00:05.000Z',
      cwd: 'E:\\p',
      sessionId: 'sess-http-1',
    }),
  ];
  writeFileSync(join(dir, 'sess-http-1.jsonl'), lines.join('\n'), 'utf8');
  return root;
}

test('GET /api/sources: per-source counts (subagents excluded)', async () => {
  const work = tmp();
  try {
    await withServer(scanDeps(work), async (base) => {
      const res = await fetch(`${base}/api/sources`);
      assert.equal(res.status, 200);
      const body = (await res.json()) as { claude: { count: number }; codex: { count: number } };
      assert.equal(body.claude.count, 1); // aaaa1111；subagents/ 被排除
      assert.equal(body.codex.count, 1);
    });
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

test('GET /api/sessions?source=claude: array excludes subagents', async () => {
  const work = tmp();
  try {
    await withServer(scanDeps(work), async (base) => {
      const res = await fetch(`${base}/api/sessions?source=claude`);
      assert.equal(res.status, 200);
      const body = (await res.json()) as Session[];
      assert.equal(body.length, 1);
      assert.equal(body[0].id, 'claude:claude-scan-1');
    });
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

test('filterByRange: 7d / 30d / all boundaries', () => {
  const now = new Date('2026-06-01T00:00:00Z');
  const mk = (id: string, daysAgo: number): Session => ({
    id,
    source: 'claude',
    title: '',
    startedAt: new Date(now.getTime() - daysAgo * 86_400_000).toISOString(),
    day: '',
    turnCount: 1,
    exported: 'none',
  });
  const sessions = [mk('a', 1), mk('b', 10), mk('c', 40)];
  assert.deepEqual(filterByRange(sessions, 'all', now).map((s) => s.id), ['a', 'b', 'c']);
  assert.deepEqual(filterByRange(sessions, '7d', now).map((s) => s.id), ['a']);
  assert.deepEqual(filterByRange(sessions, '30d', now).map((s) => s.id), ['a', 'b']);
});

test('GET /api/sessions/:id: returns meta and rounds', async () => {
  const work = tmp();
  try {
    const claudeRoot = writeClaudeFixture(work);
    await withServer({ ...scanDeps(work), claudeRoot }, async (base) => {
      const res = await fetch(`${base}/api/sessions/claude:sess-http-1`);
      assert.equal(res.status, 200);
      const body = (await res.json()) as {
        meta: { id: string };
        rounds: { question: { text: string; exported: boolean } }[];
      };
      assert.equal(body.meta.id, 'claude:sess-http-1');
      assert.equal(body.rounds.length, 1);
      assert.equal(body.rounds[0].question.text, '问A');
      assert.equal(body.rounds[0].question.exported, false);
    });
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

test('GET /api/sessions/:id?thinking=true: answer keeps reasoning (longer)', async () => {
  const work = tmp();
  try {
    const claudeRoot = writeClaudeFixture(work);
    await withServer({ ...scanDeps(work), claudeRoot }, async (base) => {
      const off = (await (await fetch(`${base}/api/sessions/claude:sess-http-1`)).json()) as {
        rounds: { answer: { text: string } }[];
      };
      const on = (await (
        await fetch(`${base}/api/sessions/claude:sess-http-1?thinking=true`)
      ).json()) as { rounds: { answer: { text: string } }[] };
      assert.ok(on.rounds[0].answer.text.length > off.rounds[0].answer.text.length);
    });
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

test('GET /api/sessions/:unknown: 404', async () => {
  const work = tmp();
  try {
    await withServer(scanDeps(work), async (base) => {
      const res = await fetch(`${base}/api/sessions/claude:does-not-exist`);
      assert.equal(res.status, 404);
    });
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

test('POST /api/export: writes md + records manifest; block then shows exported', async () => {
  const work = tmp();
  try {
    const claudeRoot = writeClaudeFixture(work);
    const deps = { ...scanDeps(work), claudeRoot };
    await withServer(deps, async (base) => {
      const res = await fetch(`${base}/api/export`, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ id: 'claude:sess-http-1', blockIds: ['r1-q', 'r1-a'], filename: 't' }),
      });
      assert.equal(res.status, 200);
      const body = (await res.json()) as { ok: boolean; path: string };
      assert.equal(body.ok, true);
      assert.ok(existsSync(body.path));
      const md = readFileSync(body.path, 'utf8');
      assert.match(md, /^---/); // front matter
      assert.match(md, /问A/);

      // 导出后块级 exported 应注入为 true
      const sess = (await (await fetch(`${base}/api/sessions/claude:sess-http-1`)).json()) as {
        rounds: { question: { exported: boolean }; answer: { exported: boolean } }[];
      };
      assert.equal(sess.rounds[0].question.exported, true);
      assert.equal(sess.rounds[0].answer.exported, true);
    });
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

test('POST /api/ai/preview: AI 未开启 → usedAi:false + degraded，不写盘（阶段 7）', async () => {
  const work = tmp();
  try {
    const claudeRoot = writeClaudeFixture(work);
    const deps = { ...scanDeps(work), claudeRoot };
    await withServer(deps, async (base) => {
      const res = await fetch(`${base}/api/ai/preview`, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ id: 'claude:sess-http-1', blockIds: ['r1-q'] }),
      });
      assert.equal(res.status, 200);
      const body = (await res.json()) as { usedAi: boolean; notes: unknown[]; degraded?: string };
      assert.equal(body.usedAi, false);
      assert.equal(body.notes.length, 0);
      assert.match(body.degraded ?? '', /未开启/);
    });
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

test('POST /api/ai/commit: 写多篇到 aiNotesDir + manifest 记 files；块标记已导出（阶段 7）', async () => {
  const work = tmp();
  try {
    const claudeRoot = writeClaudeFixture(work);
    const deps = { ...scanDeps(work), claudeRoot };
    await withServer(deps, async (base) => {
      const res = await fetch(`${base}/api/ai/commit`, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({
          id: 'claude:sess-http-1',
          blockIds: ['r1-q', 'r1-a'],
          notes: [
            { filename: '20260602-概念-A.md', content: '---\n标题: 概念-A\n---\nAAA' },
            { filename: '20260602-流程-B.md', content: 'BBB' },
          ],
        }),
      });
      assert.equal(res.status, 200);
      const body = (await res.json()) as { ok: boolean; paths: string[] };
      assert.equal(body.ok, true);
      assert.equal(body.paths.length, 2);
      for (const p of body.paths) assert.ok(existsSync(p));
      assert.ok(body.paths[0].includes('ai-notes')); // 写进 aiNotesDir
      assert.match(readFileSync(body.paths[0], 'utf8'), /AAA/);

      // manifest 记 files + aiTidy:true
      const manifest = JSON.parse(readFileSync(deps.manifestPath as string, 'utf8')) as {
        records: Record<string, { exports: { files?: string[]; aiTidy: boolean }[] }>;
      };
      const exps = manifest.records['claude:sess-http-1'].exports;
      assert.equal(exps[exps.length - 1].files?.length, 2);
      assert.equal(exps[exps.length - 1].aiTidy, true);

      // 块级 exported 注入 true（知识笔记虽是新页，但记录了来源 blocks）
      const sess = (await (await fetch(`${base}/api/sessions/claude:sess-http-1`)).json()) as {
        rounds: { question: { exported: boolean }; answer: { exported: boolean } }[];
      };
      assert.equal(sess.rounds[0].question.exported, true);
      assert.equal(sess.rounds[0].answer.exported, true);
    });
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

test('POST /api/ai/commit: 缺 notes → 400（阶段 7）', async () => {
  const work = tmp();
  try {
    const claudeRoot = writeClaudeFixture(work);
    await withServer({ ...scanDeps(work), claudeRoot }, async (base) => {
      const res = await fetch(`${base}/api/ai/commit`, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ id: 'claude:sess-http-1', blockIds: ['r1-q'] }),
      });
      assert.equal(res.status, 400);
    });
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

test('POST /api/export: missing blockIds → 400', async () => {
  const work = tmp();
  try {
    const claudeRoot = writeClaudeFixture(work);
    await withServer({ ...scanDeps(work), claudeRoot }, async (base) => {
      const res = await fetch(`${base}/api/export`, {
        method: 'POST',
        headers: JSON_HEADERS,
        body: JSON.stringify({ id: 'claude:sess-http-1' }),
      });
      assert.equal(res.status, 400);
    });
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

test('GET /api/config: apiKey redacted; PUT persists & preserves key on placeholder', async () => {
  const work = tmp();
  try {
    const deps = scanDeps(work);
    await withServer(deps, async (base) => {
      // 初始：默认配置，apiKey 空
      let cfg = (await (await fetch(`${base}/api/config`)).json()) as {
        exportDir: string;
        ai: { apiKey: string; model: string };
      };
      assert.equal(cfg.ai.apiKey, '');

      // PUT 真实 key + 改 model/exportDir
      await fetch(`${base}/api/config`, {
        method: 'PUT',
        headers: JSON_HEADERS,
        body: JSON.stringify({ exportDir: 'X', ai: { apiKey: 'secret-123', model: 'm2' } }),
      });
      cfg = (await (await fetch(`${base}/api/config`)).json()) as typeof cfg;
      assert.equal(cfg.ai.apiKey, '********'); // 脱敏
      assert.equal(cfg.ai.model, 'm2');
      assert.equal(cfg.exportDir, 'X');

      // PUT 脱敏占位 → key 保留旧值，其余照改
      await fetch(`${base}/api/config`, {
        method: 'PUT',
        headers: JSON_HEADERS,
        body: JSON.stringify({ ai: { apiKey: '********', model: 'm3' } }),
      });
      const saved = JSON.parse(readFileSync(deps.configPath as string, 'utf8')) as {
        ai: { apiKey: string; model: string };
      };
      assert.equal(saved.ai.apiKey, 'secret-123');
      assert.equal(saved.ai.model, 'm3');
    });
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

test('unknown route → 404; wrong method → 405', async () => {
  const work = tmp();
  try {
    // 显式给一个空 staticDir，避免默认 web/dist 把 /api/nope 之外的路径回成 index.html
    const emptyStatic = join(work, 'empty-static');
    mkdirSync(emptyStatic, { recursive: true });
    await withServer({ ...scanDeps(work), staticDir: emptyStatic }, async (base) => {
      assert.equal((await fetch(`${base}/api/nope`)).status, 404);
      assert.equal((await fetch(`${base}/api/export`)).status, 405); // GET on POST-only path
    });
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

// === 阶段 6：静态托管 + SPA fallback ===

/** 在临时目录铺一份最小 dist：index.html + assets/app.js + assets/app.css。 */
function writeStaticFixture(work: string): string {
  const dir = join(work, 'dist');
  mkdirSync(join(dir, 'assets'), { recursive: true });
  writeFileSync(join(dir, 'index.html'), '<!doctype html><html><body>aida</body></html>', 'utf8');
  writeFileSync(join(dir, 'assets', 'app.js'), 'console.log("ok")', 'utf8');
  writeFileSync(join(dir, 'assets', 'app.css'), 'body{color:#000}', 'utf8');
  return dir;
}

test('阶段6 静态：GET /index.html 命中且 MIME 正确；GET / 也回 index', async () => {
  const work = tmp();
  try {
    const staticDir = writeStaticFixture(work);
    await withServer({ ...scanDeps(work), staticDir }, async (base) => {
      const r1 = await fetch(`${base}/index.html`);
      assert.equal(r1.status, 200);
      assert.match(r1.headers.get('content-type') ?? '', /text\/html/);
      assert.match(await r1.text(), /aida/);

      const rRoot = await fetch(`${base}/`);
      assert.equal(rRoot.status, 200);
      assert.match(await rRoot.text(), /aida/);

      const rJs = await fetch(`${base}/assets/app.js`);
      assert.equal(rJs.status, 200);
      assert.match(rJs.headers.get('content-type') ?? '', /javascript/);
    });
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

test('阶段6 SPA fallback：未知前端路由 → 回 index.html', async () => {
  const work = tmp();
  try {
    const staticDir = writeStaticFixture(work);
    await withServer({ ...scanDeps(work), staticDir }, async (base) => {
      const r = await fetch(`${base}/app/anything/deep`);
      assert.equal(r.status, 200);
      assert.match(r.headers.get('content-type') ?? '', /text\/html/);
      assert.match(await r.text(), /aida/);
    });
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

test('阶段6 静态：/api/* 永远不被静态吞，仍 404 JSON', async () => {
  const work = tmp();
  try {
    const staticDir = writeStaticFixture(work);
    await withServer({ ...scanDeps(work), staticDir }, async (base) => {
      const r = await fetch(`${base}/api/unknown-route`);
      assert.equal(r.status, 404);
      assert.match(r.headers.get('content-type') ?? '', /application\/json/);
      const body = (await r.json()) as { ok: boolean };
      assert.equal(body.ok, false);
    });
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

test('阶段6 静态：staticDir 不存在 → API 仍可用、/index.html 404', async () => {
  const work = tmp();
  try {
    const missing = join(work, 'no-such-dir');
    await withServer({ ...scanDeps(work), staticDir: missing }, async (base) => {
      assert.equal((await fetch(`${base}/api/sources`)).status, 200);
      assert.equal((await fetch(`${base}/index.html`)).status, 404);
    });
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});

test('阶段6 静态：目录穿越 ../ 被拒（不会读到 staticDir 外文件）', async () => {
  const work = tmp();
  try {
    const staticDir = writeStaticFixture(work);
    // 在 staticDir 同级放一个不该被读到的文件
    writeFileSync(join(work, 'secret.txt'), 'TOPSECRET', 'utf8');
    await withServer({ ...scanDeps(work), staticDir }, async (base) => {
      // %2F = '/'，构造 ../secret.txt
      const r = await fetch(`${base}/..%2Fsecret.txt`);
      // 越权检测命中 → SPA fallback 回 index.html，绝不暴露 secret.txt
      const text = await r.text();
      assert.doesNotMatch(text, /TOPSECRET/);
    });
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
});
