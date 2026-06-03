// POST /api/ai/commit { id, blockIds[], notes:[{filename,content}] } → { ok, paths[] }。
// 把预览确认后的知识笔记写入 aiNotesDir（默认 02_AI对话记录）+ 记一条 manifest（files+blocks，aiTidy:true）。
import { writeExport } from '../../exporter.ts';
import { loadManifest, recordExport, saveManifest } from '../../manifest.ts';
import { loadConfig } from '../../config.ts';
import { sendError, sendJson } from '../http-util.ts';
import { resolveExportRequest } from './_session.ts';
import type { Ctx } from '../router.ts';

interface IncomingNote {
  filename: string;
  content: string;
}

export async function postAiCommit(ctx: Ctx): Promise<void> {
  const req = await resolveExportRequest(ctx);
  if (!req) return;

  const notes = coerceNotes(req.body.notes);
  if (notes.length === 0) return sendError(ctx.res, 400, '缺少 notes');

  const cfg = loadConfig(ctx.deps.configPath);
  const dir = ctx.deps.aiNotesDir ?? cfg.aiNotesDir;
  const paths = notes.map((n) => writeExport(n.content, dir, n.filename));

  const manifest = loadManifest(ctx.deps.manifestPath);
  recordExport(manifest, req.parsed.meta.id, {
    title: req.parsed.meta.title,
    exportedAt: new Date().toISOString(),
    files: paths,
    blocks: req.blockIds,
    aiTidy: true,
  });
  saveManifest(ctx.deps.manifestPath, manifest);

  sendJson(ctx.res, 200, { ok: true, paths });
}

/** 校验前端回传的 notes：要 filename(string) + content(非空 string)。 */
function coerceNotes(raw: unknown): IncomingNote[] {
  if (!Array.isArray(raw)) return [];
  const out: IncomingNote[] = [];
  for (const n of raw) {
    if (n && typeof n === 'object') {
      const filename = (n as Record<string, unknown>).filename;
      const content = (n as Record<string, unknown>).content;
      if (typeof filename === 'string' && filename.trim() && typeof content === 'string' && content.trim()) {
        out.push({ filename, content });
      }
    }
  }
  return out;
}
