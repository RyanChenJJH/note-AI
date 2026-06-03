// 两栏主界面（阶段 4 + 阶段 7）：左选会话 → 右读分轮勾块 → 底部导出。
// 导出两路：AI 关 = 原样单文件到对话存档目录；AI 开 = 预览(/api/ai/preview)→确认→写知识库(/api/ai/commit)。
import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Archive, Settings } from 'lucide-react';
import {
  aiCommit,
  aiPreview,
  getSources,
  postExport,
  type ApiError,
  type SourcesResult,
} from '@/lib/api';
import { useSessions } from '@/hooks/useSessions';
import { useSession } from '@/hooks/useSession';
import type { AiPreviewResult, Range, Source, TidyNote } from '@/lib/types';
import { SourceTabs } from '@/components/SourceTabs';
import { RangeFilter } from '@/components/RangeFilter';
import { SessionList } from '@/components/SessionList';
import { ConversationReader } from '@/components/ConversationReader';
import { ExportBar } from '@/components/ExportBar';
import { SettingsDialog } from '@/components/SettingsDialog';
import { AiPreviewDialog } from '@/components/AiPreviewDialog';

export function AppShell() {
  // —— 页面级 state ——
  const [source, setSource] = useState<Source>('claude');
  const [range, setRange] = useState<Range>('30d');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filename, setFilename] = useState('');
  const [aiTidy, setAiTidy] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null); // 手动/AI 成功提示
  const [exportError, setExportError] = useState<string | null>(null);
  const [counts, setCounts] = useState<SourcesResult | null>(null);

  // 设置 + AI 预览弹层
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<AiPreviewResult | null>(null);
  const [aiCommitting, setAiCommitting] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const list = useSessions(source, range);
  const detail = useSession(selectedId, thinking);

  // 顶栏计数（联通自检，沿用阶段 3）
  useEffect(() => {
    let alive = true;
    getSources()
      .then((s) => alive && setCounts(s))
      .catch(() => alive && setCounts(null));
    return () => {
      alive = false;
    };
  }, []);

  // 切会话：清空勾选/文件名/导出提示
  const selectSession = useCallback((id: string) => {
    setSelectedId(id);
    setSelected(new Set());
    setFilename('');
    setLastResult(null);
    setExportError(null);
  }, []);

  const toggle = useCallback((blockId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(blockId)) next.delete(blockId);
      else next.add(blockId);
      return next;
    });
  }, []);

  // 底部按钮：AI 关 → 原样导出；AI 开 → 拉预览
  function onSubmit() {
    if (!selectedId || selected.size === 0) return;
    if (aiTidy) void runAiPreview();
    else void runManualExport();
  }

  async function runManualExport() {
    setExporting(true);
    setExportError(null);
    setLastResult(null);
    try {
      const res = await postExport({
        id: selectedId!,
        blockIds: [...selected],
        filename: filename.trim() || undefined,
      });
      setLastResult(`已导出 → ${res.path}`);
      detail.refetch();
      list.refetch();
    } catch (e) {
      setExportError((e as ApiError).message);
    } finally {
      setExporting(false);
    }
  }

  async function runAiPreview() {
    setAiOpen(true);
    setAiLoading(true);
    setAiResult(null);
    setAiError(null);
    setExportError(null);
    setLastResult(null);
    try {
      const r = await aiPreview({ id: selectedId!, blockIds: [...selected] });
      setAiResult(r);
    } catch (e) {
      // 网络/服务错误也用降级 UI 呈现
      setAiResult({ usedAi: false, notes: [], degraded: (e as ApiError).message });
    } finally {
      setAiLoading(false);
    }
  }

  async function commitAi(notes: TidyNote[]) {
    if (!selectedId) return;
    setAiCommitting(true);
    setAiError(null);
    try {
      const res = await aiCommit({ id: selectedId, blockIds: [...selected], notes });
      setAiOpen(false);
      setLastResult(`已写入 ${res.paths.length} 篇知识笔记`);
      detail.refetch();
      list.refetch();
    } catch (e) {
      setAiError((e as ApiError).message);
    } finally {
      setAiCommitting(false);
    }
  }

  return (
    <div className="flex h-screen flex-col">
      {/* 顶栏 */}
      <header className="flex items-center gap-4 border-b border-border bg-card/60 px-6 py-3 backdrop-blur">
        <Link to="/" className="flex items-center gap-2 font-serif text-lg text-foreground">
          <Archive className="size-5 text-accent" />
          AI 对话档案
        </Link>
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            {counts ? `Claude ${counts.claude.count} · Codex ${counts.codex.count}` : '连接中…'}
          </span>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            aria-label="设置"
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Settings className="size-4" />
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* 左栏 */}
        <aside className="flex w-80 shrink-0 flex-col border-r border-border bg-card/40">
          <div className="flex flex-col gap-2 border-b border-border p-4">
            <SourceTabs
              value={source}
              onChange={(s) => {
                setSource(s);
              }}
              counts={counts ? { claude: counts.claude.count, codex: counts.codex.count } : undefined}
            />
            <RangeFilter value={range} onChange={setRange} />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            <SessionList
              sessions={list.data}
              loading={list.loading}
              error={list.error}
              selectedId={selectedId}
              onSelect={selectSession}
            />
          </div>
        </aside>

        {/* 右栏 */}
        <main className="flex min-w-0 flex-1 flex-col">
          <ConversationReader
            detail={detail.data}
            loading={detail.loading}
            error={detail.error}
            selected={selected}
            onToggle={toggle}
            thinking={thinking}
            onThinkingChange={setThinking}
          />
          {detail.data && (
            <ExportBar
              filename={filename}
              onFilenameChange={setFilename}
              aiTidy={aiTidy}
              onAiTidyChange={setAiTidy}
              selectedCount={selected.size}
              busy={exporting}
              lastResult={lastResult}
              error={exportError}
              onSubmit={onSubmit}
            />
          )}
        </main>
      </div>

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <AiPreviewDialog
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        loading={aiLoading}
        result={aiResult}
        committing={aiCommitting}
        error={aiError}
        onCommit={commitAi}
      />
    </div>
  );
}
