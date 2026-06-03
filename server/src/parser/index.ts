import { basename } from 'node:path';
import { readJsonl } from '../jsonl.ts';
import { parseClaude } from './claude.ts';
import { parseCodex } from './codex.ts';
import { splitRounds } from './rounds.ts';
import { truncate } from '../util.ts';
import type { NormalizedMessage, ParsedSession, ParseOptions, PartialMeta, Round, SessionMeta, Source } from '../types.ts';

/**
 * 解析单个会话文件 → { meta, rounds }。tests 与生产共用的行为级公开接口。
 * 流程：读 jsonl → 按源过滤归一 → 分轮 → 组装 meta。
 */
export function parseSessionFile(
  filePath: string,
  source: Source,
  opts: ParseOptions = {},
): ParsedSession {
  const records = readJsonl(filePath);

  let partial: PartialMeta;
  let messages: NormalizedMessage[];
  if (source === 'claude') {
    ({ meta: partial, messages } = parseClaude(records, opts));
  } else {
    ({ meta: partial, messages } = parseCodex(records, opts));
    // 每个 rollout 文件唯一的 id 来自【文件名里的 uuid】，不是 session_meta.id——
    // 后者是「会话线程 id」，会在 resume/续接时被多个 rollout 文件复用而撞车（见 docs/16）。
    partial.sessionId = codexSessionIdFromPath(filePath);
  }

  const rounds = splitRounds(messages);
  const meta = finalizeMeta(partial, rounds);
  return { meta, rounds };
}

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Codex 每文件唯一 id：取文件名末尾 uuid；非常规文件名（无 uuid）→ 整段 basename 兜底。 */
function codexSessionIdFromPath(filePath: string): string {
  const base = basename(filePath).replace(/\.jsonl$/i, '');
  const m = UUID_RE.exec(base);
  return m ? m[0] : base;
}

function finalizeMeta(partial: PartialMeta, rounds: Round[]): SessionMeta {
  return {
    id: `${partial.source}:${partial.sessionId}`,
    source: partial.source,
    sessionId: partial.sessionId,
    title: truncate(rounds[0]?.question.text ?? ''),
    startedAt: partial.startedAt,
    day: partial.startedAt.slice(0, 10),
    project: partial.project,
  };
}
