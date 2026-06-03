import { existsSync, readdirSync } from 'node:fs';
import { basename, join } from 'node:path';
import { parseSessionFile } from './parser/index.ts';
import { deriveSessionStatus, emptyManifest } from './manifest.ts';
import type { Manifest, Range, Session, Source } from './types.ts';

/**
 * 扫描 Claude 源目录 → 会话清单。
 * 排除 subagents/ 子目录里的旁路文件；空会话（无真人提问）跳过。
 */
export function scanClaude(root: string, manifest: Manifest = emptyManifest()): Session[] {
  return listJsonl(root)
    .filter((p) => !p.split(/[\\/]/).includes('subagents'))
    .map((file) => toSession(file, 'claude', manifest))
    .filter((s): s is Session => s !== null);
}

/**
 * 扫描 Codex 源目录 → 会话清单。
 * 只认 rollout-*.jsonl；day 取目录路径里的本地日期（docs/08 §7）。
 */
export function scanCodex(root: string, manifest: Manifest = emptyManifest()): Session[] {
  return listJsonl(root)
    .filter((p) => basename(p).startsWith('rollout-'))
    .map((file) => toSession(file, 'codex', manifest))
    .filter((s): s is Session => s !== null);
}

/** 扫两源合并。 */
export function scanAll(
  opts: { claudeRoot: string; codexRoot: string; manifest?: Manifest },
): Session[] {
  const m = opts.manifest ?? emptyManifest();
  return [...scanClaude(opts.claudeRoot, m), ...scanCodex(opts.codexRoot, m)];
}

/**
 * 按时间范围筛选会话清单（range 筛选在 scanner 层；docs/09 §4）。
 * 纯函数：`all` 直通；`7d`/`30d` 保留 startedAt 在 now 前 N 天内的会话。
 * 解析不出有效时间的会话保守保留（不误杀）。
 */
export function filterByRange(sessions: Session[], range: Range, now: Date = new Date()): Session[] {
  if (range === 'all') return sessions;
  const days = range === '7d' ? 7 : 30;
  const cutoff = now.getTime() - days * 24 * 60 * 60 * 1000;
  return sessions.filter((s) => {
    const t = Date.parse(s.startedAt);
    return Number.isNaN(t) ? true : t >= cutoff;
  });
}

/** 由 `${source}:${sessionId}` 反查会话文件绝对路径（先按文件名粗筛，再核对内部 id）。 */
export function resolveSessionPath(id: string, root: string, source: Source): string | undefined {
  const sessionId = id.slice(id.indexOf(':') + 1);
  const candidates = listJsonl(root).filter((f) => basename(f).includes(sessionId));
  for (const f of candidates) {
    try {
      if (parseSessionFile(f, source).meta.sessionId === sessionId) return f;
    } catch {
      // 跳过解析失败的候选
    }
  }
  return undefined;
}

function toSession(file: string, source: Source, manifest: Manifest): Session | null {
  let parsed;
  try {
    parsed = parseSessionFile(file, source);
  } catch {
    return null; // 解析整体失败 → 跳过该文件，不崩
  }
  const { meta, rounds } = parsed;
  if (rounds.length === 0) return null; // 空会话（无真人提问）跳过

  const allBlockIds = rounds.flatMap((r) => [r.question.id, r.answer.id]);
  const day = source === 'codex' ? dayFromCodexPath(file) ?? meta.day : meta.day;

  return {
    id: meta.id,
    source,
    title: meta.title,
    startedAt: meta.startedAt,
    day,
    project: meta.project,
    turnCount: rounds.length,
    exported: deriveSessionStatus(manifest, meta.id, allBlockIds),
  };
}

/** 递归列出目录下所有 .jsonl 绝对路径；目录不存在 → []。 */
function listJsonl(root: string): string[] {
  if (!existsSync(root)) return [];
  return readdirSync(root, { recursive: true })
    .map(String)
    .filter((p) => p.endsWith('.jsonl'))
    .map((p) => join(root, p));
}

/** 从 Codex rollout 文件路径里的 .../YYYY/MM/DD/ 段取本地日期。 */
function dayFromCodexPath(file: string): string | undefined {
  const m = /[\\/](\d{4})[\\/](\d{2})[\\/](\d{2})[\\/]rollout-/.exec(file);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : undefined;
}
