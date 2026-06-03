// 已导出徽章：full=● partial=◐（青色柔光，不闪）；none 不渲染。
// 颜色非唯一信息载体：同时有符号 + 文字 + title 提示（docs/04 §6）。
import { Badge } from '@/components/ui/badge';
import { badgeOf } from '@/lib/group';
import type { ExportStatus } from '@/lib/types';

const LABEL: Record<Exclude<ExportStatus, 'none'>, string> = {
  full: '已导出',
  partial: '部分导出',
};

export function ExportedBadge({ status }: { status: ExportStatus }) {
  const symbol = badgeOf(status);
  if (!symbol || status === 'none') return null;
  return (
    <Badge variant="accent" title={LABEL[status]}>
      <span aria-hidden>{symbol}</span>
      {LABEL[status]}
    </Badge>
  );
}
