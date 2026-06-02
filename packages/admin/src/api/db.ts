import {
  collection,
  doc,
  type CollectionReference,
  type DocumentReference,
  type FirestoreDataConverter,
} from 'firebase/firestore';
import { getDb } from '../lib/firebase';
import type { SourceDto } from './sources';
import type { ScheduleRuleDto } from './schedules';
import type { PromptsDto } from './prompts';
import type { AgentSettingsDto } from './settings';
import type { ResultJson } from './results';

/**
 * Typed Firestore handles for the collections used by the admin SPA.
 *
 * Keeping the converter logic centralised here means React components don't
 * need to know about Firestore plumbing — they just import doc/collection
 * helpers that already return the right TypeScript types.
 *
 * Document shapes:
 *  - config/sources    → SourcesDoc
 *  - config/prompts    → PromptsDto
 *  - config/settings   → AgentSettingsDto
 *  - config/schedules  → SchedulesDoc
 *  - runs/{runId}      → RunDoc
 *  - results/{slug}    → ResultDoc (success or rejected)
 *  - metrics/{slug}    → MetricsDoc
 *  - users/{login}     → UserDoc
 */

export interface SourcesDoc {
  items: SourceDto[];
  updatedAt?: string;
}

export interface SchedulesDoc {
  rules: ScheduleRuleDto[];
  updatedAt?: string;
}

export type RunStatus = 'queued' | 'in_progress' | 'completed' | 'failed';
export type RunTrigger = 'manual' | 'scheduled';

export interface RunDoc {
  runId: string;
  status: RunStatus;
  trigger: RunTrigger;
  source?: string | null;
  hint?: string | null;
  startedAt: string;
  finishedAt?: string | null;
  resultSlug?: string | null;
  resultStatus?: 'success' | 'rejected' | null;
  /** Workflow file that produced this run — handy for "Manual / Scheduled" badges. */
  workflowFile?: string | null;
  /** GH Actions html_url — opening the raw logs is sometimes still useful. */
  htmlUrl?: string | null;
}

export interface MetricsDoc {
  views: number;
  clicksByTour: Record<string, number>;
  firstSeenAt?: string;
  lastSeenAt?: string;
}

export interface UserDoc {
  admin: boolean;
  email: string | null;
  githubLogin: string;
  createdAt: string;
  updatedAt?: string;
}

/**
 * Result documents — the agent writes the entire PipelineRunResult shape here
 * (success or rejected) plus a flattened set of "card" fields the History
 * page can render without fetching the full body.
 */
export interface ResultDoc {
  slug: string;
  status: 'success' | 'rejected';
  createdAt: string;
  runId?: string | null;
  newsTitle?: string;
  country?: string | null;
  toursCount?: number;
  landingUrl?: string | null;
  rejectionReason?: string | null;
  rejectionMessage?: string | null;
  /** Full body matches `ResultJson` from api/results.ts; kept as opaque to
   *  avoid an import cycle with that file. */
  body: ResultJson;
}

// Plain converter that keeps everything as JSON. Firestore strips functions
// and accepts dates as strings — our agent ISO strings work as-is.
function passthroughConverter<T>(): FirestoreDataConverter<T> {
  return {
    toFirestore(value: T): Record<string, unknown> {
      return value as unknown as Record<string, unknown>;
    },
    fromFirestore(snapshot) {
      return snapshot.data() as T;
    },
  };
}

export const refs = {
  sources(): DocumentReference<SourcesDoc> {
    return doc(getDb(), 'config', 'sources').withConverter(passthroughConverter<SourcesDoc>());
  },
  schedules(): DocumentReference<SchedulesDoc> {
    return doc(getDb(), 'config', 'schedules').withConverter(passthroughConverter<SchedulesDoc>());
  },
  prompts(): DocumentReference<PromptsDto> {
    return doc(getDb(), 'config', 'prompts').withConverter(passthroughConverter<PromptsDto>());
  },
  settings(): DocumentReference<AgentSettingsDto> {
    return doc(getDb(), 'config', 'settings').withConverter(
      passthroughConverter<AgentSettingsDto>(),
    );
  },
  runs(): CollectionReference<RunDoc> {
    return collection(getDb(), 'runs').withConverter(passthroughConverter<RunDoc>());
  },
  run(runId: string): DocumentReference<RunDoc> {
    return doc(getDb(), 'runs', runId).withConverter(passthroughConverter<RunDoc>());
  },
  results(): CollectionReference<ResultDoc> {
    return collection(getDb(), 'results').withConverter(passthroughConverter<ResultDoc>());
  },
  result(slug: string): DocumentReference<ResultDoc> {
    return doc(getDb(), 'results', slug).withConverter(passthroughConverter<ResultDoc>());
  },
  metrics(slug: string): DocumentReference<MetricsDoc> {
    return doc(getDb(), 'metrics', slug).withConverter(passthroughConverter<MetricsDoc>());
  },
  user(login: string): DocumentReference<UserDoc> {
    return doc(getDb(), 'users', login).withConverter(passthroughConverter<UserDoc>());
  },
};
