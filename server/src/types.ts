// 全部共享类型定义。详见 docs/02 §4 与 docs/08 §6。

export type Source = 'claude' | 'codex';

/** 会话清单条目（scanner 输出，不含正文）。 */
export interface Session {
  id: string; // `${source}:${sessionId}`，全局唯一
  source: Source;
  title: string; // 首条真人提问（截断）
  startedAt: string; // ISO 时间
  day: string; // YYYY-MM-DD，用于日期分组（见 docs/08 §7）
  project?: string; // 记录里的 cwd
  turnCount: number; // 真人提问轮数
  exported: ExportStatus;
}

export type ExportStatus = 'none' | 'partial' | 'full';

/** 一轮 = 一次真人提问 + 其后 AI 全部可见文字回复。 */
export interface Round {
  index: number; // 第几轮，从 1 开始
  question: Block; // 人类提问
  answer: Block; // AI 文字回复（多段合并；可能为空）
}

export interface Block {
  id: string; // `r${index}-q` | `r${index}-a`
  text: string;
  exported: boolean; // 来自 manifest
}

/** 会话级元信息。 */
export interface SessionMeta {
  id: string;
  source: Source;
  sessionId: string;
  title: string;
  startedAt: string;
  day: string;
  project?: string;
}

/** parser 解析单个会话文件的产物。 */
export interface ParsedSession {
  meta: SessionMeta;
  rounds: Round[];
}

/** parser 内部归一化中间态（各源记录 → 统一消息流）。 */
export interface NormalizedMessage {
  type: 'question' | 'answer';
  text: string;
  ts: string; // ISO，用于排序
  thinking?: boolean; // 该段是否思考内容
}

export interface ParseOptions {
  includeThinking?: boolean;
}

/** 各源 parser 抽取出的会话级部分元信息（最终 meta 在 index 组装）。 */
export interface PartialMeta {
  source: Source;
  sessionId: string;
  startedAt: string;
  project?: string;
}

// ---- 已导出索引（manifest，docs/05 §4）----

export interface ManifestExport {
  exportedAt: string;
  file?: string; // 手动单篇导出路径（向后兼容）
  files?: string[]; // AI 多篇知识笔记导出路径；docs/15 §7
  blocks: string[]; // 导出了哪些块 id
  aiTidy: boolean;
}

export interface ManifestRecord {
  title: string;
  exports: ManifestExport[];
}

export interface Manifest {
  version: number;
  records: Record<string, ManifestRecord>; // key = `${source}:${sessionId}`
}

// ---- 配置（config.json，docs/06 §2 + docs/09 §5）----

export type AiProvider = 'openai-compatible' | 'anthropic' | 'ollama';

/** AI 整理配置（docs/06 + docs/15 §4）。 */
export interface AiConfig {
  enabled: boolean;
  provider: AiProvider;
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
  timeoutMs: number;
  skillPath: string; // 整理 skill 根目录（含 SKILL.md）；docs/15 §4
}

/** 应用配置：两个导出目录 + AI 配置（docs/15 §1）。 */
export interface AppConfig {
  exportDir: string; // 手动对话存档目录（默认 00_收件箱）
  aiNotesDir: string; // AI 知识笔记目录（默认 02_AI对话记录）
  ai: AiConfig;
}

/** 时间范围筛选（GET /api/sessions?range=）。 */
export type Range = '7d' | '30d' | 'all';
