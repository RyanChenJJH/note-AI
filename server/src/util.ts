/** 小工具集合。 */

/** 是否为非 null 的普通对象（便于安全访问未知 JSON 字段）。 */
export function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** 截断到 max 个字符，超出则加省略号「…」。用于列表标题（docs/03 §C）。 */
export function truncate(text: string, max = 40): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return [...flat].length <= max ? flat : [...flat].slice(0, max).join('') + '…';
}
