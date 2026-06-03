// POST /api/ai/preview { id, blockIds[] } → { usedAi, notes, noNotes?, degraded? }。
// 跑 tidy() 把勾选对话整理成知识笔记，但【不写盘】——供前端预览确认（docs/15 §6）。
import { buildMarkdown } from '../../exporter.ts';
import { loadConfig } from '../../config.ts';
import { tidy } from '../../ai/tidy.ts';
import { sendJson } from '../http-util.ts';
import { resolveExportRequest } from './_session.ts';
import type { Ctx } from '../router.ts';

export async function postAiPreview(ctx: Ctx): Promise<void> {
  const req = await resolveExportRequest(ctx);
  if (!req) return;
  const { meta, rounds } = req.parsed;

  const cfg = loadConfig(ctx.deps.configPath);
  const conversationMd = buildMarkdown(meta, rounds, req.blockIds);
  const result = await tidy({ conversationMd, meta, date: todayYmd() }, cfg.ai);

  sendJson(ctx.res, 200, {
    usedAi: result.usedAi,
    notes: result.notes,
    noNotes: result.noNotes,
    degraded: result.degraded,
  });
}

function todayYmd(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
