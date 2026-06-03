import type { NormalizedMessage, ParseOptions, PartialMeta } from '../types.ts';
import { isObject } from '../util.ts';

/**
 * Codex CLI 记录 → 归一化消息流 + 会话级元信息。
 * 过滤规则见 docs/03 §B.3。要点：只从 `response_item`+`message` 取文本，
 * 彻底忽略 `event_msg`（它会镜像同一条消息，否则每轮翻倍）。
 */
export function parseCodex(
  records: unknown[],
  _opts: ParseOptions = {},
): { meta: PartialMeta; messages: NormalizedMessage[] } {
  const messages: NormalizedMessage[] = [];
  let sessionId = '';
  let project: string | undefined;
  let startedAt = '';

  for (const rec of records) {
    if (!isObject(rec)) continue;
    const payload = isObject(rec.payload) ? rec.payload : undefined;
    const recTs = typeof rec.timestamp === 'string' ? rec.timestamp : '';

    // 首行 session_meta：会话级元信息（cwd 在 payload.cwd）。
    if (rec.type === 'session_meta' && payload) {
      if (typeof payload.id === 'string') sessionId = payload.id;
      if (typeof payload.cwd === 'string') project = payload.cwd;
      if (!startedAt) startedAt = typeof payload.timestamp === 'string' ? payload.timestamp : recTs;
      continue;
    }

    // 只认 response_item 的 message；event_msg / turn_context 等一律跳过。
    if (rec.type !== 'response_item' || !payload || payload.type !== 'message') continue;
    if (!Array.isArray(payload.content)) continue;

    const text = payload.content
      .filter((b): b is Record<string, unknown> => isObject(b) && typeof b.text === 'string')
      .map((b) => b.text as string)
      .join('\n');
    if (!text) continue;

    if (!startedAt && recTs) startedAt = recTs;

    if (payload.role === 'user') {
      // 注入的上下文（<environment_context> 等尖括号包裹）非真人输入，丢弃。
      if (isSystemWrapped(text)) continue;
      messages.push({ type: 'question', text, ts: recTs });
    } else if (payload.role === 'assistant') {
      messages.push({ type: 'answer', text, ts: recTs });
    }
    // role:developer 及其它角色 → 丢弃
  }

  return { meta: { source: 'codex', sessionId, startedAt, project }, messages };
}

/** 已知的系统注入包裹标签（出现在正文开头即非真人输入）。 */
const SYSTEM_WRAPPERS = new Set([
  'environment_context',
  'permissions',
  'user_instructions',
  'collaboration_mode',
  'apps_instructions',
  'skills_instructions',
  'plugins_instructions',
]);

/** 正文是否以已知系统包裹标签开头（如 `<environment_context>`、`<permissions instructions>`）。 */
function isSystemWrapped(text: string): boolean {
  const t = text.trimStart();
  if (!t.startsWith('<')) return false;
  const m = /^<([a-z_]+)/i.exec(t);
  return m !== null && SYSTEM_WRAPPERS.has(m[1].toLowerCase());
}
