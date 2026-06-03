import { readFileSync } from 'node:fs';

/**
 * 逐行读取 jsonl。坏行跳过并 warning，绝不抛错（docs/03 §E、docs/08 §5.1）。
 * 文件较小，整读即可。统一 UTF-8。
 */
export function readJsonl(filePath: string): unknown[] {
  const raw = readFileSync(filePath, 'utf8');
  const out: unknown[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      out.push(JSON.parse(trimmed));
    } catch {
      console.warn(`[jsonl] 跳过无法解析的行：${filePath}`);
    }
  }
  return out;
}
