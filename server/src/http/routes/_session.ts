// 导出类路由（export / ai-preview / ai-commit）共用：读 body、校验 id/blockIds、定位+解析会话。
import { resolveSessionPath } from '../../scanner.ts';
import { parseSessionFile } from '../../parser/index.ts';
import { readJsonBody, sendError } from '../http-util.ts';
import { isObject } from '../../util.ts';
import type { Ctx } from '../router.ts';
import type { ParsedSession, Source } from '../../types.ts';

export interface ResolvedExport {
  body: Record<string, unknown>; // 原始 body（commit 还要读 notes）
  id: string;
  blockIds: string[];
  parsed: ParsedSession; // { meta, rounds }
}

/** 校验并解析；失败时已发 4xx 并返回 null（调用方 `if (!req) return;`）。 */
export async function resolveExportRequest(ctx: Ctx): Promise<ResolvedExport | null> {
  const body = await readJsonBody(ctx.req);
  if (!isObject(body)) {
    sendError(ctx.res, 400, '请求体格式错误');
    return null;
  }
  const id = typeof body.id === 'string' ? body.id : '';
  const blockIds = Array.isArray(body.blockIds)
    ? body.blockIds.filter((b): b is string => typeof b === 'string')
    : [];
  if (!id) {
    sendError(ctx.res, 400, '缺少 id');
    return null;
  }
  if (blockIds.length === 0) {
    sendError(ctx.res, 400, '缺少 blockIds');
    return null;
  }

  const source: Source = id.startsWith('codex:') ? 'codex' : 'claude';
  const root = source === 'claude' ? ctx.deps.claudeRoot : ctx.deps.codexRoot;
  const file = resolveSessionPath(id, root, source);
  if (!file) {
    sendError(ctx.res, 404, `未找到会话：${id}`);
    return null;
  }

  return { body, id, blockIds, parsed: parseSessionFile(file, source) };
}
