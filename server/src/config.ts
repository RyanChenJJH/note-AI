import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { DEFAULT_AI_NOTES_DIR, DEFAULT_EXPORT_DIR, DEFAULT_SKILL_DIR } from './paths.ts';
import { isObject } from './util.ts';
import type { AppConfig } from './types.ts';

/** apiKey 脱敏占位：GET 返回有值的 key 时用它；PUT 收到它表示「不改 key」。 */
export const REDACTED = '********';

/** 默认配置（docs/06 §2：ai 全字段 + 顶层 exportDir）。 */
export function defaultConfig(): AppConfig {
  return {
    exportDir: DEFAULT_EXPORT_DIR,
    aiNotesDir: DEFAULT_AI_NOTES_DIR,
    ai: {
      enabled: false,
      provider: 'openai-compatible',
      baseUrl: 'https://api.deepseek.com/v1',
      apiKey: '',
      model: 'deepseek-chat',
      temperature: 0.3,
      timeoutMs: 60000,
      skillPath: DEFAULT_SKILL_DIR,
    },
  };
}

/** 读配置；不存在或损坏 → 默认（容错，仿 manifest，绝不抛）。缺字段用默认补齐。
 *  阶段 6：若环境变量 AIDA_EXPORT_DIR 存在，覆盖最终 cfg.exportDir
 *  （生产/隔离测试用；不动 server/data/config.json 的字面值）。 */
export function loadConfig(path: string): AppConfig {
  const cfg = readConfigOrDefault(path);
  if (process.env.AIDA_EXPORT_DIR) cfg.exportDir = process.env.AIDA_EXPORT_DIR;
  if (process.env.AIDA_AI_NOTES_DIR) cfg.aiNotesDir = process.env.AIDA_AI_NOTES_DIR;
  if (process.env.AIDA_SKILL_DIR) cfg.ai.skillPath = process.env.AIDA_SKILL_DIR;
  return cfg;
}

function readConfigOrDefault(path: string): AppConfig {
  if (!existsSync(path)) return defaultConfig();
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
    if (isObject(parsed)) return coerce(parsed);
  } catch {
    console.warn(`[config] 无法解析，按默认处理：${path}`);
  }
  return defaultConfig();
}

/** 写配置（自动建目录）。 */
export function saveConfig(path: string, cfg: AppConfig): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(cfg, null, 2), 'utf8');
}

/** 给前端的脱敏副本：apiKey 有值 → 占位符，空 → 保持空。 */
export function redactConfig(cfg: AppConfig): AppConfig {
  return { ...cfg, ai: { ...cfg.ai, apiKey: cfg.ai.apiKey ? REDACTED : '' } };
}

/**
 * 合并 PUT 入参到现有配置：只覆盖出现的字段；
 * apiKey 为脱敏占位（或缺省）时保留旧值，否则采用新值。
 */
export function mergeConfig(old: AppConfig, incoming: unknown): AppConfig {
  if (!isObject(incoming)) return old;
  const next = defaultConfig();
  next.exportDir = typeof incoming.exportDir === 'string' ? incoming.exportDir : old.exportDir;
  next.aiNotesDir = typeof incoming.aiNotesDir === 'string' ? incoming.aiNotesDir : old.aiNotesDir;

  const ai = isObject(incoming.ai) ? incoming.ai : {};
  next.ai = {
    enabled: typeof ai.enabled === 'boolean' ? ai.enabled : old.ai.enabled,
    provider: ai.provider === 'anthropic' || ai.provider === 'ollama' || ai.provider === 'openai-compatible'
      ? ai.provider
      : old.ai.provider,
    baseUrl: typeof ai.baseUrl === 'string' ? ai.baseUrl : old.ai.baseUrl,
    apiKey: typeof ai.apiKey === 'string' && ai.apiKey !== REDACTED ? ai.apiKey : old.ai.apiKey,
    model: typeof ai.model === 'string' ? ai.model : old.ai.model,
    temperature: typeof ai.temperature === 'number' ? ai.temperature : old.ai.temperature,
    timeoutMs: typeof ai.timeoutMs === 'number' ? ai.timeoutMs : old.ai.timeoutMs,
    skillPath: typeof ai.skillPath === 'string' ? ai.skillPath : old.ai.skillPath,
  };
  return next;
}

/** 把未知对象强转为 AppConfig：缺字段用默认补齐（容错读取）。 */
function coerce(raw: Record<string, unknown>): AppConfig {
  // 复用 mergeConfig 的字段级容错：以默认为底，叠加文件内容（apiKey 直采）。
  const base = defaultConfig();
  const merged = mergeConfig(base, raw);
  // mergeConfig 会把脱敏占位当“不改”，但文件里不应有占位；此处直采文件 apiKey。
  const ai = isObject(raw.ai) ? raw.ai : {};
  if (typeof ai.apiKey === 'string') merged.ai.apiKey = ai.apiKey;
  return merged;
}
