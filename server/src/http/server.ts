import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { fileURLToPath } from 'node:url';
import { claudeRoot, codexRoot, configPath, manifestPath, serverPort, staticDir } from '../paths.ts';
import { matchRoute } from './router.ts';
import type { Ctx, Route } from './router.ts';
import { BadJson, sendError } from './http-util.ts';
import { tryServeStatic } from './static.ts';
import { getSources } from './routes/sources.ts';
import { getSession, listSessions } from './routes/sessions.ts';
import { postExport } from './routes/export.ts';
import { postAiPreview } from './routes/ai-preview.ts';
import { postAiCommit } from './routes/ai-commit.ts';
import { getConfig, putConfig } from './routes/config.ts';

/** 注入依赖：默认取 paths.ts，测试可指向 fixtures/临时目录。 */
export interface Deps {
  claudeRoot: string;
  codexRoot: string;
  manifestPath: string;
  configPath: string;
  /** 覆盖导出目录（测试用）；省略时取 config.exportDir。 */
  exportDir?: string;
  /** 覆盖 AI 知识笔记目录（测试用）；省略时取 config.aiNotesDir。 */
  aiNotesDir?: string;
  /** 前端静态根目录（阶段 6 同源托管）；省略时取 paths.staticDir()。 */
  staticDir?: string;
}

function defaultDeps(): Deps {
  return {
    claudeRoot: claudeRoot(),
    codexRoot: codexRoot(),
    manifestPath: manifestPath(),
    configPath: configPath(),
    staticDir: staticDir(),
  };
}

const routes: Route[] = [
  { method: 'GET', path: '/api/sources', handler: getSources },
  { method: 'GET', path: '/api/sessions', handler: listSessions },
  { method: 'GET', path: '/api/sessions/:id', handler: getSession },
  { method: 'POST', path: '/api/export', handler: postExport },
  { method: 'POST', path: '/api/ai/preview', handler: postAiPreview },
  { method: 'POST', path: '/api/ai/commit', handler: postAiCommit },
  { method: 'GET', path: '/api/config', handler: getConfig },
  { method: 'PUT', path: '/api/config', handler: putConfig },
];

/**
 * 构建 HTTP 服务（未 listen）。把阶段 1 内核包一层 HTTP。
 * 每个请求 try/catch 兜底，进程绝不崩；BadJson → 400。
 */
export function createApiServer(overrides: Partial<Deps> = {}): Server {
  const deps: Deps = { ...defaultDeps(), ...overrides };

  return createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1');
    const { match, pathMatched } = matchRoute(routes, req.method ?? 'GET', url.pathname);

    if (!match) {
      // 路径模板命中但方法错 → 405（API 语义优先于静态层）
      if (pathMatched) {
        sendError(res, 405, '方法不被允许');
        return;
      }
      // 静态层兜底：GET/HEAD 在 staticDir 内找文件，非 /api/* 则 SPA fallback
      if (deps.staticDir) {
        try {
          if (tryServeStatic(req, res, deps.staticDir, url.pathname)) return;
        } catch (err) {
          console.error('[http] 静态资源失败：', err);
        }
      }
      sendError(res, 404, '未找到路由');
      return;
    }

    const ctx: Ctx = { req, res, deps, url, params: match.params };
    Promise.resolve()
      .then(() => match.route.handler(ctx))
      .catch((err: unknown) => {
        if (res.headersSent) return;
        if (err instanceof BadJson) {
          sendError(res, 400, err.message);
          return;
        }
        console.error('[http] 处理失败：', err);
        sendError(res, 500, '服务器内部错误');
      });
  });
}

/** 直接运行 `node src/http/server.ts` 时启动服务（被 import 时不监听）。 */
if (fileURLToPath(import.meta.url) === process.argv[1]) {
  const port = serverPort();
  createApiServer().listen(port, '127.0.0.1', () => {
    console.log(`AI 对话档案 · API 已启动 → http://127.0.0.1:${port}`);
  });
}
