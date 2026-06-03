import { loadConfig, mergeConfig, redactConfig, saveConfig } from '../../config.ts';
import { readJsonBody, sendJson } from '../http-util.ts';
import type { Ctx } from '../router.ts';

/** GET /api/config → 脱敏后的配置（apiKey 不回传明文）。 */
export function getConfig(ctx: Ctx): void {
  sendJson(ctx.res, 200, redactConfig(loadConfig(ctx.deps.configPath)));
}

/** PUT /api/config → 合并保存（apiKey 收到脱敏占位则保留旧值）→ { ok }。 */
export async function putConfig(ctx: Ctx): Promise<void> {
  const body = await readJsonBody(ctx.req);
  const merged = mergeConfig(loadConfig(ctx.deps.configPath), body);
  saveConfig(ctx.deps.configPath, merged);
  sendJson(ctx.res, 200, { ok: true });
}
