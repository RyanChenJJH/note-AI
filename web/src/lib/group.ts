// 纯逻辑（无 React/无 @ 别名，便于 node:test）：会话按日期分组 + 徽章符号。
import type { ExportStatus, Session } from './types.ts';

export interface DayGroup {
  day: string; // YYYY-MM-DD
  items: Session[];
}

/**
 * 按 day 聚合：组按 day 倒序（新→旧）；组内按 startedAt 倒序。
 * 输入不被修改（内部复制后排序）。
 */
export function groupByDay(sessions: Session[]): DayGroup[] {
  const map = new Map<string, Session[]>();
  for (const s of sessions) {
    const arr = map.get(s.day) ?? [];
    arr.push(s);
    map.set(s.day, arr);
  }
  const groups: DayGroup[] = [];
  for (const [day, items] of map) {
    items.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    groups.push({ day, items });
  }
  groups.sort((a, b) => b.day.localeCompare(a.day));
  return groups;
}

/** 徽章符号：full=● partial=◐ none=null（不渲染）。 */
export function badgeOf(status: ExportStatus): '●' | '◐' | null {
  if (status === 'full') return '●';
  if (status === 'partial') return '◐';
  return null;
}
