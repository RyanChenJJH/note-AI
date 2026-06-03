// 右栏阅读区：分轮渲染，每块独立 checkbox + 块级已导出标注；头部带思考过程开关。
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import type { Block, SessionDetail } from '@/lib/types';

interface Props {
  detail: SessionDetail | null;
  loading: boolean;
  error: string | null;
  selected: Set<string>;
  onToggle: (blockId: string) => void;
  thinking: boolean;
  onThinkingChange: (v: boolean) => void;
}

function BlockView({
  block,
  label,
  selected,
  onToggle,
}: {
  block: Block;
  label: string;
  selected: boolean;
  onToggle: (id: string) => void;
}) {
  const empty = block.text.trim().length === 0;
  return (
    <div
      className={cn(
        'rounded-lg border px-4 py-3 transition-colors',
        selected ? 'border-accent bg-accent/5' : 'border-border bg-card',
      )}
    >
      <div className="mb-2 flex items-center gap-2">
        <Checkbox
          checked={selected}
          disabled={empty}
          onChange={() => onToggle(block.id)}
          aria-label={`选择${label}`}
        />
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        {block.exported && (
          <span className="inline-flex items-center gap-0.5 text-xs text-accent" title="此块已导出">
            <Check className="size-3" />
            已导出
          </span>
        )}
      </div>
      {empty ? (
        <p className="pl-6 text-sm italic text-muted-foreground">（无文字回复）</p>
      ) : (
        <p className="whitespace-pre-wrap break-words pl-6 text-sm leading-relaxed text-foreground">
          {block.text}
        </p>
      )}
    </div>
  );
}

export function ConversationReader({
  detail,
  loading,
  error,
  selected,
  onToggle,
  thinking,
  onThinkingChange,
}: Props) {
  if (loading)
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        加载对话中…
      </div>
    );
  if (error)
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-destructive">
        {error}
      </div>
    );
  if (!detail)
    return (
      <div className="flex flex-1 items-center justify-center px-10 text-center text-sm text-muted-foreground">
        从左侧选择一个会话开始阅读与导出。
      </div>
    );

  const { meta, rounds } = detail;
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* 会话头部 */}
      <div className="flex items-start justify-between gap-4 border-b border-border px-6 py-4">
        <div className="min-w-0">
          <h2 className="truncate font-serif text-lg text-foreground">
            {meta.title || '（无标题）'}
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {meta.source} · {rounds.length} 轮 · {meta.day}
            {meta.project ? ` · ${meta.project}` : ''}
          </p>
        </div>
        <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs text-muted-foreground">
          显示思考过程
          <Switch checked={thinking} onCheckedChange={onThinkingChange} />
        </label>
      </div>

      {/* 分轮正文 */}
      <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
        {rounds.map((r) => (
          <div key={r.index} className="space-y-2">
            <BlockView
              block={r.question}
              label={`第 ${r.index} 轮 · 提问`}
              selected={selected.has(r.question.id)}
              onToggle={onToggle}
            />
            <BlockView
              block={r.answer}
              label={`第 ${r.index} 轮 · 回复`}
              selected={selected.has(r.answer.id)}
              onToggle={onToggle}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
