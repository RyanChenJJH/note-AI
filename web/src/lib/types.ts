// 前端共享类型，镜像后端 docs/02 §4 的数据结构（仅取前端需要的字段）。
export type Source = 'claude' | 'codex';
export type ExportStatus = 'none' | 'partial' | 'full';
export type Range = '7d' | '30d' | 'all';

/** 会话清单条目（GET /api/sessions）。 */
export interface Session {
  id: string;
  source: Source;
  title: string;
  startedAt: string;
  day: string; // YYYY-MM-DD
  project?: string;
  turnCount: number;
  exported: ExportStatus;
}

/** 块：一次提问或一段回复。 */
export interface Block {
  id: string; // r{n}-q | r{n}-a
  text: string;
  exported: boolean;
}

/** 一轮 = 提问 + 回复。 */
export interface Round {
  index: number;
  question: Block;
  answer: Block;
}

/** 会话级元信息（GET /api/sessions/:id 的 meta）。 */
export interface SessionMeta {
  id: string;
  source: Source;
  sessionId: string;
  title: string;
  startedAt: string;
  day: string;
  project?: string;
}

export interface SessionDetail {
  meta: SessionMeta;
  rounds: Round[];
}

/** POST /api/export 入参与出参（手动原样导出，阶段 7 起不含 aiTidy）。 */
export interface ExportRequest {
  id: string;
  blockIds: string[];
  filename?: string;
}
export interface ExportResult {
  ok: boolean;
  path: string;
  usedAi?: boolean;
}

// ---- AI 整理（阶段 7，docs/15）----

export type AiProvider = 'openai-compatible' | 'anthropic' | 'ollama';

/** AI 整理配置（镜像后端；GET 时 apiKey 脱敏为 ******** 或空）。 */
export interface AiConfig {
  enabled: boolean;
  provider: AiProvider;
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
  timeoutMs: number;
  skillPath: string;
}

/** 应用配置（GET/PUT /api/config）。 */
export interface AppConfig {
  exportDir: string; // 手动对话存档目录
  aiNotesDir: string; // AI 知识笔记目录
  ai: AiConfig;
}

/** 一篇知识笔记（含自带 frontmatter 的整篇 md）。 */
export interface TidyNote {
  filename: string;
  content: string;
}

/** POST /api/ai/preview 出参（不写盘）。 */
export interface AiPreviewResult {
  usedAi: boolean;
  notes: TidyNote[];
  noNotes?: string; // 模型判定无可沉淀知识
  degraded?: string; // 降级原因（未配置/超时/失败）
}

/** POST /api/ai/commit 入参与出参。 */
export interface AiCommitRequest {
  id: string;
  blockIds: string[];
  notes: TidyNote[];
}
export interface AiCommitResult {
  ok: boolean;
  paths: string[];
}
