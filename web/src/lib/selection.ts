// 纯逻辑（可单测）：勾选块集合的增删与整轮全选判断。
import type { Round } from './types.ts';

/** 切换单个块的勾选状态，返回新 Set（不改原集合）。 */
export function toggleBlock(selected: Set<string>, blockId: string): Set<string> {
  const next = new Set(selected);
  if (next.has(blockId)) next.delete(blockId);
  else next.add(blockId);
  return next;
}

/** 一轮内有文本的块 id（空回复块不参与勾选/导出）。 */
export function roundBlockIds(round: Round): string[] {
  const ids = [round.question.id];
  if (round.answer.text.trim().length > 0) ids.push(round.answer.id);
  return ids;
}

/** 全选/全不选所有有文本的块（用于"全选"操作）。 */
export function allBlockIds(rounds: Round[]): string[] {
  return rounds.flatMap(roundBlockIds);
}
