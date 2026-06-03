import { homedir } from 'node:os';
import { join } from 'node:path';

// 源目录与默认路径。可用环境变量覆盖（便于测试/换机）。

/** Claude Code 源根：~/.claude/projects */
export function claudeRoot(): string {
  return process.env.AIDA_CLAUDE_ROOT ?? join(homedir(), '.claude', 'projects');
}

/** Codex CLI 源根：~/.codex/sessions */
export function codexRoot(): string {
  return process.env.AIDA_CODEX_ROOT ?? join(homedir(), '.codex', 'sessions');
}

/** 已导出索引文件：server/data/manifest.json */
export function manifestPath(): string {
  return process.env.AIDA_MANIFEST ?? join(import.meta.dirname, '..', 'data', 'manifest.json');
}

/** 配置文件：server/data/config.json（阶段 2 新增；docs/06 §2 + docs/09 §5）。 */
export function configPath(): string {
  return process.env.AIDA_CONFIG ?? join(import.meta.dirname, '..', 'data', 'config.json');
}

/** HTTP 服务端口（仅监听 127.0.0.1）；可用 AIDA_PORT 覆盖，默认 8787。 */
export function serverPort(): number {
  const n = Number(process.env.AIDA_PORT);
  return Number.isFinite(n) && n > 0 ? n : 8787;
}

/**
 * 前端静态根目录（阶段 6 同源托管 `web/dist`）。
 * 默认 `<repo>/web/dist`（从 server/src 出发 `../../web/dist`）；
 * 可用 AIDA_STATIC_DIR 覆盖；目录不存在时静态层静默跳过（dev 期照常用 Vite 代理）。
 */
export function staticDir(): string {
  return process.env.AIDA_STATIC_DIR ?? join(import.meta.dirname, '..', '..', 'web', 'dist');
}

/** 手动导出（对话存档）默认目录（docs/05 §1；阶段 7 由 02_AI对话记录 改为 00_收件箱）。 */
export const DEFAULT_EXPORT_DIR = 'E:\\Work2\\Obsidians_database\\00_资源库\\00_收件箱';

/** AI 知识笔记默认目录（docs/15 §1）。 */
export const DEFAULT_AI_NOTES_DIR = 'E:\\Work2\\Obsidians_database\\00_资源库\\02_AI对话记录';

/** 整理 skill 默认根目录（含 SKILL.md；docs/15 §1）。 */
export const DEFAULT_SKILL_DIR =
  'E:\\Work2\\AI_Work\\Skill\\my_personal_skill\\chenao_note_ai\\chenao-note-ai';

/** 阶段 1 CLI 自测导出目录（不污染正式 Obsidian 库；docs/08 §7）。 */
export function testExportDir(): string {
  return process.env.AIDA_EXPORT_DIR ?? join(import.meta.dirname, '..', 'data', '_exports_test');
}
