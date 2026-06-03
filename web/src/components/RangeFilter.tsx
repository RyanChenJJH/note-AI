// 时间范围筛选：7天 / 1月 / 全部 → '7d' | '30d' | 'all'（后端 scanner 层筛选）。
import { Segmented } from '@/components/ui/segmented';
import type { Range } from '@/lib/types';

interface Props {
  value: Range;
  onChange: (r: Range) => void;
}

export function RangeFilter({ value, onChange }: Props) {
  return (
    <Segmented<Range>
      ariaLabel="时间范围"
      value={value}
      onChange={onChange}
      className="w-full"
      options={[
        { value: '7d', label: '7天' },
        { value: '30d', label: '1月' },
        { value: 'all', label: '全部' },
      ]}
    />
  );
}
