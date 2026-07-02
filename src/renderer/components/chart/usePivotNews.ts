// Progressive pivot-news pipeline. Runs AFTER the chart has rendered (the
// effect fires on the commit in which the resolved candles/pivots landed, and
// child effects — ChartCanvas's setData — run first). One getPivotNews call
// per pivot, pushed through a tiny concurrency-3 queue with allSettled
// semantics: each settlement patches its own group so the panel fills in
// progressively; a failure marks only that group as 'error'. Results are
// cached per range+pivot for the modal's lifetime, and the whole pipeline is
// keyed on the chart generation so a mid-flight range switch discards
// everything stale.

import { useEffect, useRef, useState } from 'react';
import type { ChartRange, NewsItem, PivotPoint } from '../../../shared/types';
import { api } from '../../api';

export type PivotNewsStatus = 'pending' | 'done' | 'error';

export interface PivotNewsGroup {
  pivot: PivotPoint;
  status: PivotNewsStatus;
  items: NewsItem[];
}

const CONCURRENCY = 3;

export function usePivotNews(
  symbol: string,
  range: ChartRange,
  pivots: PivotPoint[],
  generation: number,
): { groups: PivotNewsGroup[]; pending: boolean } {
  // Cache survives range switches (keys embed the range); the modal remounts
  // per symbol so no symbol key is needed.
  const cacheRef = useRef<Map<string, NewsItem[]>>(new Map());
  const [groups, setGroups] = useState<PivotNewsGroup[]>([]);

  useEffect(() => {
    if (pivots.length === 0) {
      setGroups([]);
      return;
    }
    let cancelled = false;
    const keyOf = (p: PivotPoint) => `${range}|${p.kind}|${p.time}`;

    const initial: PivotNewsGroup[] = pivots.map((pivot) => {
      const hit = cacheRef.current.get(keyOf(pivot));
      return hit
        ? { pivot, status: 'done' as const, items: hit }
        : { pivot, status: 'pending' as const, items: [] };
    });
    setGroups(initial);

    const jobs = pivots
      .map((pivot, index) => ({ pivot, index }))
      .filter(({ index }) => initial[index].status === 'pending');
    if (jobs.length === 0) return;

    let cursor = 0;
    const settle = (index: number, status: PivotNewsStatus, items: NewsItem[]) => {
      setGroups((prev) =>
        prev.map((g, i) => (i === index ? { ...g, status, items } : g)),
      );
    };

    const worker = async (): Promise<void> => {
      while (!cancelled && cursor < jobs.length) {
        const job = jobs[cursor++];
        try {
          const results = await api.getPivotNews(symbol, [job.pivot]);
          if (cancelled) return;
          const items = results[0]?.items ?? [];
          cacheRef.current.set(keyOf(job.pivot), items);
          settle(job.index, 'done', items);
        } catch {
          if (cancelled) return;
          settle(job.index, 'error', []);
        }
      }
    };
    for (let i = 0; i < Math.min(CONCURRENCY, jobs.length); i++) void worker();

    return () => {
      cancelled = true;
    };
    // `generation` covers symbol/range/retry; `pivots` identity flips exactly
    // when new candles resolve within a generation (loading → data).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [generation, pivots]);

  return { groups, pending: groups.some((g) => g.status === 'pending') };
}
