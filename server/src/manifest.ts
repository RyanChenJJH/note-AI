import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { ExportStatus, Manifest, ManifestExport } from './types.ts';
import { isObject } from './util.ts';

/** 空 manifest。 */
export function emptyManifest(): Manifest {
  return { version: 1, records: {} };
}

/** 追加一条导出记录（不写盘）。docs/05 §4.2。 */
export function recordExport(
  m: Manifest,
  id: string,
  entry: ManifestExport & { title: string },
): void {
  const rec = m.records[id] ?? { title: entry.title, exports: [] };
  rec.title = entry.title;
  rec.exports.push({
    exportedAt: entry.exportedAt,
    file: entry.file, // 手动单篇（undefined 时 JSON 自动省略）
    files: entry.files, // AI 多篇（docs/15 §7）
    blocks: entry.blocks,
    aiTidy: entry.aiTidy,
  });
  m.records[id] = rec;
}

/** 某会话所有导出块的并集。 */
export function deriveBlockStatus(m: Manifest, id: string): Set<string> {
  const out = new Set<string>();
  for (const exp of m.records[id]?.exports ?? []) {
    for (const b of exp.blocks) out.add(b);
  }
  return out;
}

/** 会话导出状态推导（docs/05 §4.3）。allBlockIds = 该会话全部块 id。 */
export function deriveSessionStatus(m: Manifest, id: string, allBlockIds: string[]): ExportStatus {
  const exported = deriveBlockStatus(m, id);
  if (exported.size === 0) return 'none';
  const coversAll = allBlockIds.length > 0 && allBlockIds.every((b) => exported.has(b));
  return coversAll ? 'full' : 'partial';
}

/** 读 manifest；不存在或损坏 → 返回空（容错，绝不抛）。 */
export function loadManifest(path: string): Manifest {
  if (!existsSync(path)) return emptyManifest();
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
    if (isObject(parsed) && isObject(parsed.records) && typeof parsed.version === 'number') {
      return parsed as unknown as Manifest;
    }
  } catch {
    console.warn(`[manifest] 无法解析，按空处理：${path}`);
  }
  return emptyManifest();
}

/** 写 manifest（自动建目录）。 */
export function saveManifest(path: string, m: Manifest): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(m, null, 2), 'utf8');
}
