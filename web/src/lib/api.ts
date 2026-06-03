// 后端 API 薄封装：所有请求走同源 /api（dev 由 Vite 代理到 127.0.0.1:8787）。
// 仅读写后端，绝不直接访问 .claude/.codex/导出目录（约束见 docs/02 §7）。
import type {
  AiCommitRequest,
  AiCommitResult,
  AiPreviewResult,
  AppConfig,
  ExportRequest,
  ExportResult,
  Range,
  Session,
  SessionDetail,
  Source,
} from './types.ts';

export interface ApiError {
  status: number;
  message: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      headers: { 'Content-Type': 'application/json' },
      ...init,
    });
  } catch {
    // 网络层失败（后端没起/被拒）：归一为离线错误，调用方自行降级。
    throw { status: 0, message: '无法连接本地服务（请确认后端已启动）' } as ApiError;
  }
  if (!res.ok) {
    let message = `请求失败（${res.status}）`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) message = body.error;
    } catch {
      /* 非 JSON 错误体，沿用默认文案 */
    }
    throw { status: res.status, message } as ApiError;
  }
  return (await res.json()) as T;
}

export const apiGet = <T>(path: string) => request<T>(path);

export interface SourcesResult {
  claude: { count: number };
  codex: { count: number };
}

export const getSources = () => apiGet<SourcesResult>('/api/sources');

/** 列表：某源 + 时间范围；后端 scanner 层已做范围筛选。 */
export const getSessions = (source: Source, range: Range) =>
  apiGet<Session[]>(`/api/sessions?source=${source}&range=${range}`);

/** 单会话分轮；thinking=true 时回复保留思考过程。 */
export const getSession = (id: string, thinking: boolean) =>
  apiGet<SessionDetail>(
    `/api/sessions/${encodeURIComponent(id)}${thinking ? '?thinking=true' : ''}`,
  );

/** 手动导出选中块为 md（原样），后端写文件 + 记 manifest。 */
export const postExport = (body: ExportRequest) =>
  request<ExportResult>('/api/export', {
    method: 'POST',
    body: JSON.stringify(body),
  });

// ---- AI 整理 + 配置（阶段 7）----

/** 读配置（apiKey 已脱敏）。 */
export const getConfig = () => apiGet<AppConfig>('/api/config');

/** 保存配置（apiKey 传 ******** 表示不改）。 */
export const putConfig = (cfg: AppConfig) =>
  request<{ ok: boolean }>('/api/config', { method: 'PUT', body: JSON.stringify(cfg) });

/** AI 预览：把勾选块整理成知识笔记，不写盘（10–60s）。 */
export const aiPreview = (body: { id: string; blockIds: string[] }) =>
  request<AiPreviewResult>('/api/ai/preview', { method: 'POST', body: JSON.stringify(body) });

/** AI 提交：把确认后的笔记写入知识库目录 + 记 manifest。 */
export const aiCommit = (body: AiCommitRequest) =>
  request<AiCommitResult>('/api/ai/commit', { method: 'POST', body: JSON.stringify(body) });
