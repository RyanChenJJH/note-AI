// 懒加载某源的会话列表：仅当 source/range 变化时请求；按 key 缓存于 useRef(Map)。
// 输出 {data, loading, error, refetch}；refetch 让当前 key 失效并重拉（导出后刷新徽章）。
import { useCallback, useEffect, useRef, useState } from 'react';
import { getSessions, type ApiError } from '@/lib/api';
import type { Range, Session, Source } from '@/lib/types';

interface State {
  data: Session[] | null;
  loading: boolean;
  error: string | null;
}

export function useSessions(source: Source, range: Range) {
  const cache = useRef(new Map<string, Session[]>());
  const [state, setState] = useState<State>({ data: null, loading: false, error: null });
  const key = `${source}|${range}`;

  const load = useCallback(
    async (force = false) => {
      if (!force && cache.current.has(key)) {
        setState({ data: cache.current.get(key)!, loading: false, error: null });
        return;
      }
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const data = await getSessions(source, range);
        cache.current.set(key, data);
        setState({ data, loading: false, error: null });
      } catch (e) {
        setState({ data: null, loading: false, error: (e as ApiError).message });
      }
    },
    [key, source, range],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const refetch = useCallback(() => {
    cache.current.delete(key);
    void load(true);
  }, [key, load]);

  return { ...state, refetch };
}
