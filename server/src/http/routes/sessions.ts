import { filterByRange, resolveSessionPath, scanAll, scanClaude, scanCodex } from '../../scanner.ts';
import { deriveBlockStatus, loadManifest } from '../../manifest.ts';
import { parseSessionFile } from '../../parser/index.ts';
import { sendError, sendJson } from '../http-util.ts';
import type { Ctx } from '../router.ts';
import type { Range, Source } from '../../types.ts';

/** GET /api/sessions?source=&range= → Session[]（range 在 scanner 层筛；按时间降序）。 */
export function listSessions(ctx: Ctx): void {
  const m = loadManifest(ctx.deps.manifestPath);
  const source = ctx.url.searchParams.get('source');
  const range = normalizeRange(ctx.url.searchParams.get('range'));

  const scanned =
    source === 'claude'
      ? scanClaude(ctx.deps.claudeRoot, m)
      : source === 'codex'
        ? scanCodex(ctx.deps.codexRoot, m)
        : scanAll({ claudeRoot: ctx.deps.claudeRoot, codexRoot: ctx.deps.codexRoot, manifest: m });

  const sessions = filterByRange(scanned, range).sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
  sendJson(ctx.res, 200, sessions);
}

/** GET /api/sessions/:id?thinking= → { meta, rounds }；块级 exported 由 manifest 注入。 */
export function getSession(ctx: Ctx): void {
  const { id } = ctx.params;
  const source: Source = id.startsWith('codex:') ? 'codex' : 'claude';
  const root = source === 'claude' ? ctx.deps.claudeRoot : ctx.deps.codexRoot;

  const file = resolveSessionPath(id, root, source);
  if (!file) return sendError(ctx.res, 404, `未找到会话：${id}`);

  const includeThinking = ctx.url.searchParams.get('thinking') === 'true';
  const { meta, rounds } = parseSessionFile(file, source, { includeThinking });

  const exported = deriveBlockStatus(loadManifest(ctx.deps.manifestPath), id);
  const withStatus = rounds.map((r) => ({
    index: r.index,
    question: { ...r.question, exported: exported.has(r.question.id) },
    answer: { ...r.answer, exported: exported.has(r.answer.id) },
  }));

  sendJson(ctx.res, 200, { meta, rounds: withStatus });
}

function normalizeRange(v: string | null): Range {
  return v === '7d' || v === '30d' ? v : 'all';
}
