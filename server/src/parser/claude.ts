import type { NormalizedMessage, ParseOptions, PartialMeta } from '../types.ts';
import { isObject } from '../util.ts';

/**
 * Claude Code 记录 → 归一化消息流 + 会话级元信息。
 * 过滤规则见 docs/03 §A.3。
 */
export function parseClaude(
  records: unknown[],
  opts: ParseOptions = {},
): { meta: PartialMeta; messages: NormalizedMessage[] } {
  const messages: NormalizedMessage[] = [];
  let sessionId = '';
  let project: string | undefined;
  let startedAt = '';

  for (const rec of records) {
    if (!isObject(rec)) continue;
    if (rec.isSidechain === true) continue; // 子任务/Agent 旁路，丢弃

    const ts = typeof rec.timestamp === 'string' ? rec.timestamp : '';
    if (!sessionId && typeof rec.sessionId === 'string') sessionId = rec.sessionId;
    if (!project && typeof rec.cwd === 'string') project = rec.cwd;
    if (!startedAt && ts) startedAt = ts;

    const message = isObject(rec.message) ? rec.message : undefined;

    if (rec.type === 'user' && message) {
      const content = message.content;
      // 字符串 content = 真人提问
      if (typeof content === 'string') {
        messages.push({ type: 'question', text: content, ts });
      } else if (Array.isArray(content)) {
        // 数组 content：含 tool_result = 工具结果回流，丢弃；
        // 否则取其中的 text 块拼成真人提问。
        const hasToolResult = content.some((b) => isObject(b) && b.type === 'tool_result');
        if (!hasToolResult) {
          const text = content
            .filter((b): b is Record<string, unknown> => isObject(b) && b.type === 'text' && typeof b.text === 'string')
            .map((b) => b.text as string)
            .join('\n');
          if (text) messages.push({ type: 'question', text, ts });
        }
      }
    } else if (rec.type === 'assistant' && message) {
      const content = message.content;
      if (Array.isArray(content)) {
        for (const block of content) {
          if (!isObject(block)) continue;
          // text = 可见正文；thinking = 思考（默认丢，开关开则保留）；tool_use 等丢弃。
          if (block.type === 'text' && typeof block.text === 'string') {
            // 某些自定义 provider 把推理混进正文并以 </think> 收尾；默认裁掉（docs/08 §2.1）。
            const text = opts.includeThinking ? block.text : stripInlineThinking(block.text);
            if (text) messages.push({ type: 'answer', text, ts });
          } else if (block.type === 'thinking' && opts.includeThinking && typeof block.thinking === 'string') {
            messages.push({ type: 'answer', text: block.thinking, ts, thinking: true });
          }
        }
      }
    }
  }

  return { meta: { source: 'claude', sessionId, startedAt, project }, messages };
}

/** 裁掉正文里 `</think>` 及其之前的内联推理；无该标记则原样返回。 */
function stripInlineThinking(text: string): string {
  const marker = '</think>';
  const idx = text.indexOf(marker);
  if (idx === -1) return text;
  return text.slice(idx + marker.length).replace(/^\s+/, '');
}
