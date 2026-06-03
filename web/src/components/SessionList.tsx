// 左栏列表：按日期分组、可折叠；条目带已导出徽章。入场 stagger、悬停轻浮、选中青色描边。
import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { groupByDay } from '@/lib/group';
import { ExportedBadge } from '@/components/ExportedBadge';
import type { Session } from '@/lib/types';

interface Props {
  sessions: Session[] | null;
  loading: boolean;
  error: string | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

function timeOf(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

export function SessionList({ sessions, loading, error, selectedId, onSelect }: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  if (loading) return <p className="px-1 py-6 text-sm text-muted-foreground">加载中…</p>;
  if (error) return <p className="px-1 py-6 text-sm text-destructive">{error}</p>;
  if (!sessions || sessions.length === 0)
    return <p className="px-1 py-6 text-sm text-muted-foreground">此范围内没有会话。</p>;

  const groups = groupByDay(sessions);
  let rowIndex = 0; // 全局序号，用于跨组连续 stagger

  return (
    <div className="flex flex-col gap-3">
      {groups.map((g) => {
        const isCollapsed = collapsed.has(g.day);
        return (
          <section key={g.day}>
            <button
              type="button"
              onClick={() =>
                setCollapsed((prev) => {
                  const next = new Set(prev);
                  if (next.has(g.day)) next.delete(g.day);
                  else next.add(g.day);
                  return next;
                })
              }
              className="flex w-full items-center gap-1 px-1 py-1 text-xs font-medium text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              {isCollapsed ? (
                <ChevronRight className="size-3.5" />
              ) : (
                <ChevronDown className="size-3.5" />
              )}
              {g.day}
              <span className="ml-1 text-muted-foreground/70">({g.items.length})</span>
            </button>

            {!isCollapsed && (
              <ul className="mt-1 flex flex-col gap-1">
                {g.items.map((s) => {
                  const active = s.id === selectedId;
                  const delay = Math.min(rowIndex++, 12) * 35; // stagger ≤ 420ms
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => onSelect(s.id)}
                        style={{ animationDelay: `${delay}ms` }}
                        className={cn(
                          'w-full animate-[rowin_240ms_ease-out_both] rounded-lg border px-3 py-2 text-left transition-all duration-200 outline-none',
                          'hover:-translate-y-0.5 hover:bg-muted hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring',
                          active
                            ? 'border-accent bg-card shadow-sm'
                            : 'border-transparent bg-card/60',
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="line-clamp-2 font-serif text-sm leading-snug text-foreground">
                            {s.title || '（无标题）'}
                          </span>
                          <ExportedBadge status={s.exported} />
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {s.turnCount} 轮 · {timeOf(s.startedAt)}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}

      <style>{`
        @keyframes rowin { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}
