import { useEffect, useState } from 'react';
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { getDb } from '../lib/firebase';
import {
  docToResultMeta,
  type ResultDocLike,
  type ResultMeta,
} from '../api/results';
import type { RunDoc } from '../api/db';

/** Realtime view over the History page data. */

export interface FirestoreHistoryState {
  loading: boolean;
  results: ResultMeta[];
  pending: RunDoc[];
  error: string | null;
}

export function useFirestoreHistory(): FirestoreHistoryState {
  const [state, setState] = useState<FirestoreHistoryState>({
    loading: true,
    results: [],
    pending: [],
    error: null,
  });

  useEffect(() => {
    const db = getDb();
    // Latest 200 completed/skipped runs.
    const resultsQ = query(
      collection(db, 'results'),
      orderBy('createdAt', 'desc'),
      limit(200),
    );
    // Active runs (in_progress / queued).
    const runsQ = query(
      collection(db, 'runs'),
      where('status', 'in', ['queued', 'in_progress']),
    );

    let resultsReady = false;
    let runsReady = false;
    const maybeFinishLoading = () => {
      if (resultsReady && runsReady) {
        setState((s) => ({ ...s, loading: false }));
      }
    };

    const unsubResults = onSnapshot(
      resultsQ,
      (snap) => {
        const results = snap.docs.map((d) =>
          docToResultMeta(d.data() as ResultDocLike, d.id),
        );
        setState((s) => ({ ...s, results, error: null }));
        resultsReady = true;
        maybeFinishLoading();
      },
      (err) => {
        setState((s) => ({ ...s, error: err.message, loading: false }));
      },
    );
    const unsubRuns = onSnapshot(
      runsQ,
      (snap) => {
        const pending = snap.docs.map((d) => d.data() as RunDoc);
        // Stable sort: newest startedAt first.
        pending.sort((a, b) =>
          (b.startedAt ?? '').localeCompare(a.startedAt ?? ''),
        );
        setState((s) => ({ ...s, pending, error: null }));
        runsReady = true;
        maybeFinishLoading();
      },
      (err) => {
        setState((s) => ({ ...s, error: err.message, loading: false }));
      },
    );

    return () => {
      unsubResults();
      unsubRuns();
    };
  }, []);

  return state;
}
