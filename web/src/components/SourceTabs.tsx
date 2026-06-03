// 分类切换：Codex / Claude。可附计数（来自 GET /api/sources）。点击切换触发懒加载。
import { Segmented } from '@/components/ui/segmented';
import type { Source } from '@/lib/types';

interface Props {
  value: Source;
  onChange: (s: Source) => void;
  counts?: { claude: number; codex: number };
}

export function SourceTabs({ value, onChange, counts }: Props) {
  return (
    <Segmented<Source>
      ariaLabel="会话来源"
      value={value}
      onChange={onChange}
      className="w-full"
      options={[
        { value: 'claude', label: 'Claude', hint: counts ? String(counts.claude) : undefined },
        { value: 'codex', label: 'Codex', hint: counts ? String(counts.codex) : undefined },
      ]}
    />
  );
}
