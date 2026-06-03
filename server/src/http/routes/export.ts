// POST /api/export：手动「原样导出」单文件到 exportDir（默认 00_收件箱）。
// 阶段 7：AI 整理已拆到 /api/ai/preview + /api/ai/commit，本路由不再处理 aiTidy。
import { buildMarkdown, writeExport } from '../../exporter.ts';
import { loadManifest, recordExport, saveManifest } from '../../manifest.ts';
import { loadConfig } from '../../config.ts';
import { sendJson } from '../http-util.ts';
import { resolveExportRequest } from './_session.ts';
import type { Ctx } from '../router.ts';

/** POST /api/export { id, blockIds[], filename? } → { ok, path }。 */
export async function postExport(ctx: Ctx): Promise<void> {
  const req = await resolveExportRequest(ctx);
  if (!req) return;
  const { meta, rounds } = req.parsed;

  const cfg = loadConfig(ctx.deps.configPath);
  const md = buildMarkdown(meta, rounds, req.blockIds);

  const dir = ctx.deps.exportDir ?? cfg.exportDir;
  const filename =
    typeof req.body.filename === 'string' && req.body.filename.trim()
      ? req.body.filename
      : meta.title.slice(0, 20);
  const out = writeExport(md, dir, filename);

  const manifest = loadManifest(ctx.deps.manifestPath);
  recordExport(manifest, meta.id, {
    title: meta.title,
    exportedAt: new Date().toISOString(),
    file: out,
    blocks: req.blockIds,
    aiTidy: false,
  });
  saveManifest(ctx.deps.manifestPath, manifest);

  sendJson(ctx.res, 200, { ok: true, path: out, usedAi: false });
}
