// Chart data loader for the modal: fetches candles for the active range,
// caches per range for the modal's lifetime (toggling back is instant), and
// exposes a monotonic `generation` counter. The generation bumps on every
// load (range switch or retry); any async consumer — most importantly the
// pivot-news pipeline — must throw away results that belong to an older
// generation so switching ranges mid-flight never shows stale data.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChartData, ChartRange } from '../../../shared/types';
import { api } from '../../api';

export interface ChartDataState {
  data: ChartData | null;
  loading: boolean;
  error: string | null;
  /** Bumps on every load; loading state and its resolved data share a value. */
  generation: number;
}

export function useChartData(
  symbol: string,
  range: ChartRange,
): ChartDataState & { retry: () => void } {
  const cacheRef = useRef<Map<ChartRange, ChartData>>(new Map());
  const genRef = useRef(0);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<ChartDataState>({
    data: null,
    loading: true,
    error: null,
    generation: 0,
  });

  useEffect(() => {
    const gen = ++genRef.current;
    const cached = cacheRef.current.get(range);
    if (cached) {
      setState({ data: cached, loading: false, error: null, generation: gen });
      return;
    }
    setState({ data: null, loading: true, error: null, generation: gen });
    let cancelled = false;
    api
      .getChart(symbol, range)
      .then((data) => {
        if (cancelled || gen !== genRef.current) return; // stale response
        cacheRef.current.set(range, data);
        setState({ data, loading: false, error: null, generation: gen });
      })
      .catch((err: unknown) => {
        if (cancelled || gen !== genRef.current) return;
        const message =
          err instanceof Error && err.message
            ? err.message
            : 'The chart request failed.';
        setState({ data: null, loading: false, error: message, generation: gen });
      });
    return () => {
      cancelled = true;
    };
  }, [symbol, range, attempt]);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);

  return { ...state, retry };
}
