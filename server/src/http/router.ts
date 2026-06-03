import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Deps } from './server.ts';

/** 路由上下文：注入依赖 + 解析好的 query/params。 */
export interface Ctx {
  req: IncomingMessage;
  res: ServerResponse;
  deps: Deps;
  url: URL;
  params: Record<string, string>;
}

export type Handler = (ctx: Ctx) => Promise<void> | void;

export interface Route {
  method: string;
  /** 路径模板，段以 `:name` 声明参数，如 `/api/sessions/:id`。 */
  path: string;
  handler: Handler;
}

interface MatchResult {
  route: Route;
  params: Record<string, string>;
}

/**
 * 在路由表里匹配 method + pathname。
 * 返回命中的 route 与解析出的 params；`pathMatched` 标记路径命中但方法不符（用于 405）。
 */
export function matchRoute(
  routes: Route[],
  method: string,
  pathname: string,
): { match?: MatchResult; pathMatched: boolean } {
  const segments = split(pathname);
  let pathMatched = false;

  for (const route of routes) {
    const params = matchPath(split(route.path), segments);
    if (!params) continue;
    pathMatched = true;
    if (route.method === method) return { match: { route, params }, pathMatched: true };
  }
  return { pathMatched };
}

/** 路径模板段 vs 实际段：匹配则返回 params，否则 undefined。 */
function matchPath(template: string[], actual: string[]): Record<string, string> | undefined {
  if (template.length !== actual.length) return undefined;
  const params: Record<string, string> = {};
  for (let i = 0; i < template.length; i++) {
    const t = template[i];
    if (t.startsWith(':')) {
      params[t.slice(1)] = decodeURIComponent(actual[i]);
    } else if (t !== actual[i]) {
      return undefined;
    }
  }
  return params;
}

function split(path: string): string[] {
  return path.split('/').filter(Boolean);
}
