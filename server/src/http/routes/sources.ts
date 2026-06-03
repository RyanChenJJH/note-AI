import { scanClaude, scanCodex } from '../../scanner.ts';
import { loadManifest } from '../../manifest.ts';
import { sendJson } from '../http-util.ts';
import type { Ctx } from '../router.ts';

/** GET /api/sources → 各源可列会话数（口径同列表：已排除 subagents/空会话）。 */
export function getSources(ctx: Ctx): void {
  const m = loadManifest(ctx.deps.manifestPath);
  const claude = scanClaude(ctx.deps.claudeRoot, m).length;
  const codex = scanCodex(ctx.deps.codexRoot, m).length;
  sendJson(ctx.res, 200, { claude: { count: claude }, codex: { count: codex } });
}
