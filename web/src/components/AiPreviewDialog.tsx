// AI 整理预览弹层（阶段 7）：展示模型整理出的多篇知识笔记草稿，勾选/改名后确认写入；
// 或展示「无可沉淀知识(NO NOTES)」「AI 不可用(降级)」。loading 期提示耗时。
import { useEffect, useState } from 'react';
import { FileText, Sparkles } from 'lucide-react';
import type { AiPreviewResult, TidyNote } from '@/lib/types';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';

interface NoteRow {
  include: boolean;
  filename: string;
  content: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  result: AiPreviewResult | null;
  committing: boolean;
  error: string | null; // commit 错误
  onCommit: (notes: TidyNote[]) => void;
}

export function AiPreviewDialog({ open, onClose, loading, result, committing, error, onCommit }: Props) {
  const [rows, setRows] = useState<NoteRow[]>([]);

  useEffect(() => {
    setRows((result?.notes ?? []).map((n) => ({ include: true, filename: n.filename, content: n.content })));
  }, [result]);

  const chosen = rows.filter((r) => r.include && r.filename.trim());
  const setRow = (i: number, p: Partial<NoteRow>) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, ...p } : r)));

  const hasNotes = !loading && result && result.notes.length > 0;
  const footer = hasNotes ? (
    <>
      {error && <span className="mr-auto text-xs text-destructive">{error}</span>}
      <Button variant="ghost" onClick={onClose}>
        取消
      </Button>
      <Button
        variant="accent"
        disabled={chosen.length === 0 || committing}
        onClick={() => onCommit(chosen.map((r) => ({ filename: r.filename.trim(), content: r.content })))}
      >
        {committing ? '写入中…' : `确认写入 ${chosen.length} 篇`}
      </Button>
    </>
  ) : (
    <Button variant="ghost" onClick={onClose}>
      关闭
    </Button>
  );

  return (
    <Modal open={open} onClose={onClose} title="AI 整理预览" className="max-w-2xl" footer={footer}>
      {loading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="size-4 animate-pulse text-accent" />
          AI 整理中…（可能需要 10–60 秒）
        </p>
      ) : !result ? (
        <p className="text-sm text-muted-foreground">无结果。</p>
      ) : result.degraded ? (
        <div className="rounded-md bg-muted px-3 py-3 text-sm">
          <p className="font-medium text-foreground">AI 暂不可用</p>
          <p className="mt-1 text-muted-foreground">{result.degraded}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            请在「设置」里检查 AI 配置（provider / key / model），或关闭「AI 整理」开关按原样导出。
          </p>
        </div>
      ) : result.notes.length === 0 ? (
        <div className="rounded-md bg-muted px-3 py-3 text-sm">
          <p className="font-medium text-foreground">没有够格沉淀的知识</p>
          <p className="mt-1 text-muted-foreground">{result.noNotes ?? '模型判断本段无可复用知识。'}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">
            AI 整理出 {rows.length} 篇知识笔记（草稿）。勾选要保存的、可改文件名，确认后写入知识库目录。
          </p>
          {rows.map((r, i) => (
            <div key={i} className="rounded-lg border border-border">
              <div className="flex items-center gap-2 px-3 py-2">
                <Checkbox
                  checked={r.include}
                  onChange={(e) => setRow(i, { include: e.target.checked })}
                  aria-label="包含此篇"
                />
                <FileText className="size-4 shrink-0 text-accent" />
                <Input
                  value={r.filename}
                  onChange={(e) => setRow(i, { filename: e.target.value })}
                  className="h-8 text-xs"
                  aria-label="文件名"
                />
              </div>
              <details className="border-t border-border">
                <summary className="cursor-pointer px-3 py-1.5 text-xs text-muted-foreground">预览正文</summary>
                <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words bg-muted/40 px-3 py-2 text-xs text-foreground">
                  {r.content}
                </pre>
              </details>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
