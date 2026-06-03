// 底部导出栏（阶段 7）：AI 开 = 主按钮触发「AI 整理…」(预览→确认写知识库)；
// AI 关 = 文件名 + 「导出为 .md」(原样写对话存档)。三态（空选/进行中/成功）。
import { Download, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

interface Props {
  filename: string;
  onFilenameChange: (v: string) => void;
  aiTidy: boolean;
  onAiTidyChange: (v: boolean) => void;
  selectedCount: number;
  busy: boolean; // 手动导出中（AI 进行态在预览弹层里）
  lastResult: string | null; // 上次成功提示（手动路径或 AI 写入）
  error: string | null;
  onSubmit: () => void;
}

export function ExportBar({
  filename,
  onFilenameChange,
  aiTidy,
  onAiTidyChange,
  selectedCount,
  busy,
  lastResult,
  error,
  onSubmit,
}: Props) {
  const disabled = selectedCount === 0 || busy;
  return (
    <div className="border-t border-border bg-card/70 px-6 py-3 backdrop-blur">
      <div className="flex flex-wrap items-center gap-3">
        {!aiTidy && (
          <Input
            value={filename}
            onChange={(e) => onFilenameChange(e.target.value)}
            placeholder="文件名（留空用标题）"
            className="max-w-xs flex-1"
            aria-label="导出文件名"
          />
        )}

        <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
          <Switch checked={aiTidy} onCheckedChange={onAiTidyChange} />
          AI 整理
        </label>

        <span className="text-xs text-muted-foreground">已选 {selectedCount} 块</span>

        <Button variant="accent" onClick={onSubmit} disabled={disabled} className="ml-auto gap-2">
          {aiTidy ? <Sparkles className="size-4" /> : <Download className="size-4" />}
          {aiTidy ? (busy ? '整理中…' : 'AI 整理…') : busy ? '导出中…' : '导出为 .md'}
        </Button>
      </div>

      {/* 提示行：错误 / 成功 / AI 预告 */}
      <div className="mt-1.5 min-h-4 text-xs">
        {error ? (
          <span className="text-destructive">{error}</span>
        ) : lastResult ? (
          <span className="text-accent">{lastResult}</span>
        ) : (
          aiTidy && (
            <span className="text-muted-foreground">
              AI 整理：先预览生成的知识笔记，确认后写入知识库目录。
            </span>
          )
        )}
      </div>
    </div>
  );
}
