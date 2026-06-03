// 分段控件（tabs/range 共用）：受控 value/onChange，选中段青色。
// 用 role=tablist/tab + aria-selected 可达。复用给 SourceTabs 与 RangeFilter。
import { cn } from '@/lib/utils';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  hint?: string; // 附属说明（如计数）
}

interface SegmentedProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (v: T) => void;
  ariaLabel?: string;
  className?: string;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: SegmentedProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn('inline-flex gap-1 rounded-lg bg-muted p-1', className)}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors outline-none',
              'focus-visible:ring-2 focus-visible:ring-ring',
              active
                ? 'bg-card text-accent shadow-xs'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {opt.label}
            {opt.hint != null && (
              <span className="text-xs text-muted-foreground">{opt.hint}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
