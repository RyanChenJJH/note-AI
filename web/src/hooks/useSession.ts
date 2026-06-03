// 加载单会话分轮：仅当 id/thinking 变化时请求；按 key 缓存。id 为 null 时不请求。
// 输出 {data, loading, error, refetch}；导出后 refetch 拿到回写的块级 exported。
import { useCallback, useEffect, useRef, useState } from 'react';
import { getSession, type ApiError } from '@/lib/api';
import type { SessionDetail } from '@/lib/types';

interface State {
  data: SessionDetail | null;
  loading: boolean;
  error: string | null;
}

export function useSession(id: string | null, thinking: boolean) {
  const cache = useRef(new Map<string, SessionDetail>());
  const [state, setState] = useState<State>({ data: null, loading: false, error: null });
  const key = id ? `${id}|${thinking}` : null;

  const load = useCallback(
    async (force = false) => {
      if (!id || !key) {
        setState({ data: null, loading: false, error: null });
        return;
      }
      if (!force && cache.current.has(key)) {
        setState({ data: cache.current.get(key)!, loading: false, error: null });
        return;
      }
      setState((s) => ({ ...s, loading: true, error: null }));
      try {
        const data = await getSession(id, thinking);
        cache.current.set(key, data);
        setState({ data, loading: false, error: null });
      } catch (e) {
        setState({ data: null, loading: false, error: (e as ApiError).message });
      }
    },
    [id, key, thinking],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const refetch = useCallback(() => {
    // 失效该会话的所有 thinking 变体（导出影响块状态，与 thinking 无关）。
    if (id) {
      cache.current.delete(`${id}|true`);
      cache.current.delete(`${id}|false`);
    }
    void load(true);
  }, [id, load]);

  return { ...state, refetch };
}
