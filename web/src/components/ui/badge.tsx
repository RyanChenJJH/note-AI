// 小徽章：用于已导出标注等。变体映射晨雾 token。
import * as React from 'react';
import { cn } from '@/lib/utils';

type Variant = 'accent' | 'muted' | 'outline';

const variants: Record<Variant, string> = {
  accent: 'bg-accent/10 text-accent',
  muted: 'bg-muted text-muted-foreground',
  outline: 'border border-border text-muted-foreground',
};

function Badge({
  className,
  variant = 'muted',
  ...props
}: React.ComponentProps<'span'> & { variant?: Variant }) {
  return (
    <span
      data-slot="badge"
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium',
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}

export { Badge };
