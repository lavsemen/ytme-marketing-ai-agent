import { getDoc, runTransaction, serverTimestamp } from 'firebase/firestore';
import { getDb } from '../lib/firebase';
import { refs } from './db';

export interface SourceDto {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  language: string;
  type?: 'rss' | 'html' | 'auto';
  createdAt?: string;
  updatedAt?: string;
}

export interface SourcesFile {
  sources: SourceDto[];
}

export async function loadSources(): Promise<SourcesFile> {
  const snap = await getDoc(refs.sources());
  if (!snap.exists()) return { sources: [] };
  const data = snap.data() as { items?: SourceDto[] };
  return { sources: Array.isArray(data.items) ? data.items : [] };
}

/**
 * Atomic mutation of sources via Firestore transaction. The mutator receives
 * the FRESH list so callers can de-dupe by id and never overwrite concurrent
 * edits silently.
 */
export async function applySourceChange(
  mutator: (current: SourceDto[]) => SourceDto[],
): Promise<SourceDto[]> {
  let computed: SourceDto[] = [];
  await runTransaction(getDb(), async (t) => {
    const ref = refs.sources();
    const snap = await t.get(ref);
    const current: SourceDto[] = snap.exists()
      ? Array.isArray(snap.data()?.items)
        ? (snap.data()!.items as SourceDto[])
        : []
      : [];
    const next = mutator(current);
    computed = next;
    t.set(ref, {
      items: next,
      updatedAt: serverTimestamp() as unknown as string,
    });
  });
  return computed;
}
