// useOptimisticAction — utility hook cho hot-path mobile (Done, Cancel, Comment).
// Pattern: setState ngay khi user bấm → fire RPC → rollback nếu fail.
// In-memory only (không persist cross-session — realtime sẽ đồng bộ khi mạng phục hồi).
'use client';

import { useCallback, useRef } from 'react';
import { notifyError } from '@/lib/notify';
import type { ActionResult } from '../_lib/types';

export function useOptimisticAction<T extends { id: string }>(
  items: T[],
  setItems: (updater: (prev: T[]) => T[]) => void,
) {
  // Snapshot bản gốc của row để rollback khi RPC fail
  const snapshotRef = useRef<Map<string, T>>(new Map());

  const run = useCallback(
    async (
      id: string,
      patch: Partial<T>,
      rpc: () => Promise<ActionResult<unknown>>,
      errorTitle = 'Không cập nhật được',
    ) => {
      const original = items.find(x => x.id === id);
      if (!original) return;

      snapshotRef.current.set(id, original);

      // Apply optimistic patch + đánh dấu _pending
      setItems(prev =>
        prev.map(x =>
          x.id === id ? ({ ...x, ...patch, _pending: true } as T) : x,
        ),
      );

      const result = await rpc();

      if (!result.ok) {
        // Rollback
        const snap = snapshotRef.current.get(id);
        setItems(prev =>
          prev.map(x => (x.id === id && snap ? ({ ...snap, _pending: false } as T) : x)),
        );
        notifyError(result.error, errorTitle);
      } else {
        // Pending xong → realtime sẽ đồng bộ phía sau; clear flag local
        setItems(prev =>
          prev.map(x => (x.id === id ? ({ ...x, _pending: false } as T) : x)),
        );
      }
      snapshotRef.current.delete(id);
    },
    [items, setItems],
  );

  const isPending = useCallback(
    (id: string) => snapshotRef.current.has(id),
    [],
  );

  return { run, isPending };
}
