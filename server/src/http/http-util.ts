import type { IncomingMessage, ServerResponse } from 'node:http';

/** 发送 JSON 响应。 */
export function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(payload);
}

/** 发送错误响应：`{ ok:false, error }`。 */
export function sendError(res: ServerResponse, status: number, error: string): void {
  sendJson(res, status, { ok: false, error });
}

/**
 * 读取并解析请求体为 JSON。空体 → {}；非法 JSON → 抛 BadJson（由调用方转 400）。
 * 限制 1MB，超限抛错（防滥用）。
 */
export async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1_000_000) throw new BadJson('请求体过大');
    chunks.push(chunk as Buffer);
  }
  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    throw new BadJson('请求体不是合法 JSON');
  }
}

/** body 解析失败标记，便于 server.ts 区分并返回 400。 */
export class BadJson extends Error {}
