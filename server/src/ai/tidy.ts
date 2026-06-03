// AI 整理编排（docs/15 §5.4）。把勾选对话 md 交给模型，按 skill 整理成多篇知识笔记。
// 任何失败/未配置/超时/无法解析都转 degraded（不抛），由调用方降级回原样导出。
import type { AiConfig, SessionMeta } from '../types.ts';
import { loadSkill } from './skill.ts';
import { getProvider } from './provider.ts';
import type { ChatMessage } from './provider.ts';
import { parseNotes } from './parse.ts';

export type { TidyNote } from './parse.ts';
import type { TidyNote } from './parse.ts';

export interface TidyInput {
  conversationMd: string; // 勾选块拼成的完整对话 md（含 AIDA frontmatter，buildMarkdown 产物）
  meta: SessionMeta; // 供 source_id/来源 拼接
  date: string; // 整理日期 YYYY-MM-DD（默认今天）
}

export interface TidyResult {
  usedAi: boolean; // 是否真走了模型
  notes: TidyNote[]; // 0+ 篇知识笔记；degraded 时为空
  noNotes?: string; // 模型判定无可沉淀知识（<<<NO NOTES: 原因>>>）
  degraded?: string; // 降级原因（未配置/超时/失败/无法解析）；有值时 notes 空、usedAi=false
}

export async function tidy(input: TidyInput, cfg: AiConfig): Promise<TidyResult> {
  if (!cfg.enabled) return degraded('未开启 AI 整理');
  if (needsKey(cfg.provider) && !cfg.apiKey.trim()) return degraded('未配置 API Key');

  let systemPrompt: string;
  try {
    systemPrompt = loadSkill(cfg.skillPath).systemPrompt;
  } catch (e) {
    return degraded(`载入 skill 失败：${msg(e)}`);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1000, cfg.timeoutMs));
  try {
    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: buildUserMessage(input) },
    ];
    const raw = await getProvider(cfg.provider).chat(messages, cfg, controller.signal);
    const { notes, noNotes } = parseNotes(raw);
    if (!notes.length && noNotes === undefined) return degraded('模型输出无法解析');
    return { usedAi: true, notes, noNotes };
  } catch (e) {
    return degraded(failReason(e, cfg.timeoutMs));
  } finally {
    clearTimeout(timer);
  }
}

/** 用户消息：整理日期 + source_id（来源描述）+ 对话 md 全文。 */
function buildUserMessage(input: TidyInput): string {
  const { meta } = input;
  const sourceId = `AI对话《${meta.title}》(${meta.source}, ${meta.day})`;
  return [
    `整理日期: ${input.date}`,
    `source_id: ${sourceId}`,
    '',
    '下面是需要整理的对话 md 全文：',
    '',
    input.conversationMd,
  ].join('\n');
}

function needsKey(p: AiConfig['provider']): boolean {
  return p !== 'ollama';
}

function degraded(reasonText: string): TidyResult {
  return { usedAi: false, notes: [], degraded: reasonText };
}

function failReason(e: unknown, timeoutMs: number): string {
  if (e && typeof e === 'object' && (e as { name?: string }).name === 'AbortError') {
    return `AI 超时（>${Math.round(timeoutMs / 1000)}s）`;
  }
  return `AI 调用失败：${msg(e)}`;
}

function msg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
