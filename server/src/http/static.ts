// 静态资源 + SPA fallback：阶段 6 让 server 同源托管 web/dist。
// 仅 GET/HEAD；路径规范化后必须仍在 staticDir 内（防目录穿越）；
// 文件不存在且非 /api/* → 回 index.html，让前端 React Router 路由可直链/刷新。

import { existsSync, statSync, createReadStream } from 'node:fs';
import { resolve, sep, extname } from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';

/** 最小够用 MIME 表；命中外一律 application/octet-stream。 */
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'text/plain; charset=utf-8',
};

/**
 * 尝试用 staticDir 处理 GET/HEAD 请求。
 *  - 命中文件 → 200 + MIME，返回 true。
 *  - /api/* 永远不走 SPA fallback（保留 API 404 JSON 语义）→ 返回 false。
 *  - 其它路径 + 文件不存在 → 回 index.html（SPA fallback），返回 true。
 *  - index.html 也不存在或 staticDir 缺失 → 返回 false（交回上游 404）。
 * 出错（IO/越权）一律返回 false，由上游兜底，**不抛**。
 */
export function tryServeStatic(
  req: IncomingMessage,
  res: ServerResponse,
  staticDir: string,
  pathname: string,
): boolean {
  const method = req.method ?? 'GET';
  if (method !== 'GET' && method !== 'HEAD') return false;
  if (!existsSync(staticDir)) return false;

  const root = resolve(staticDir);

  // 1. 直接命中文件（先解码再 resolve；非法编码当作未命中）
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return false;
  }
  const target = resolve(root, '.' + (decoded === '/' ? '/index.html' : decoded));
  if (target === root || target.startsWith(root + sep)) {
    if (existsSync(target) && statSync(target).isFile()) {
      sendFile(res, target, method);
      return true;
    }
  }

  // 2. /api/* 不走 SPA fallback
  if (pathname.startsWith('/api/')) return false;

  // 3. SPA fallback → index.html
  const indexHtml = resolve(root, 'index.html');
  if (existsSync(indexHtml) && statSync(indexHtml).isFile()) {
    sendFile(res, indexHtml, method);
    return true;
  }
  return false;
}

function sendFile(res: ServerResponse, file: string, method: string): void {
  const type = MIME[extname(file).toLowerCase()] ?? 'application/octet-stream';
  const size = statSync(file).size;
  res.writeHead(200, { 'Content-Type': type, 'Content-Length': String(size) });
  if (method === 'HEAD') {
    res.end();
    return;
  }
  createReadStream(file).pipe(res);
}
