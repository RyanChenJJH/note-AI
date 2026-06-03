// 复选框：原生 input[type=checkbox]（键盘/读屏天然可达），青色选中态。
import * as React from 'react';
import { cn } from '@/lib/utils';

function Checkbox({ className, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type="checkbox"
      data-slot="checkbox"
      className={cn(
        'size-4 shrink-0 cursor-pointer rounded-[4px] border border-input accent-accent',
        'focus-visible:ring-2 focus-visible:ring-ring outline-none',
        className,
      )}
      {...props}
    />
  );
}

export { Checkbox };
