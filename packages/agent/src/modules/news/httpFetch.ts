import { request } from 'undici';

export const NEWS_HTTP = {
  /** Max wait for response headers (fail fast on slow hosts). */
  headersTimeoutMs: 10_000,
  /** Max wait for response body after headers. */
  bodyTimeoutMs: 20_000,
  /** Hard cap for one source (index + article pages + RSS). */
  sourceDeadlineMs: 45_000,
  /** How many sources to fetch in parallel. */
  sourceConcurrency: 5,
  /** Max article URLs to try per HTML source. */
  htmlMaxLinkAttempts: 10,
} as const;

export const NEWS_USER_AGENT =
  'YouTravelMarketingAgent/0.1 (+https://youtravel.me) Mozilla/5.0';

export class FetchDeadlineError extends Error {
  constructor(label: string, ms: number) {
    super(`${label}: fetch deadline exceeded (${ms}ms)`);
    this.name = 'FetchDeadlineError';
  }
}

export function isFetchAbortError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const code = (err as { code?: string }).code;
  return (
    err.name === 'AbortError' ||
    err.name === 'FetchDeadlineError' ||
    err.name === 'HeadersTimeoutError' ||
    err.name === 'BodyTimeoutError' ||
    code === 'UND_ERR_HEADERS_TIMEOUT' ||
    code === 'UND_ERR_BODY_TIMEOUT' ||
    err.message.includes('fetch deadline exceeded')
  );
}

/** Runs `fn` with an AbortSignal that fires after `ms`. Clears the timer when done. */
export async function withSourceDeadline<T>(
  label: string,
  ms: number,
  fn: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const ac = new AbortController();
  const timer = setTimeout(() => {
    ac.abort(new FetchDeadlineError(label, ms));
  }, ms);
  try {
    return await fn(ac.signal);
  } finally {
    clearTimeout(timer);
  }
}

export interface FetchTextOptions {
  signal?: AbortSignal;
  headersTimeoutMs?: number;
  bodyTimeoutMs?: number;
}

export async function fetchText(
  url: string,
  options: FetchTextOptions = {},
): Promise<{ text: string; statusCode: number; finalUrl: string }> {
  if (options.signal?.aborted) {
    throw options.signal.reason ?? new FetchDeadlineError(url, 0);
  }

  const res = await request(url, {
    method: 'GET',
    signal: options.signal,
    headersTimeout: options.headersTimeoutMs ?? NEWS_HTTP.headersTimeoutMs,
    bodyTimeout: options.bodyTimeoutMs ?? NEWS_HTTP.bodyTimeoutMs,
    headers: {
      'User-Agent': NEWS_USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'ru,en;q=0.8',
    },
  });

  if (options.signal?.aborted) {
    throw options.signal.reason ?? new FetchDeadlineError(url, 0);
  }

  if (res.statusCode < 200 || res.statusCode >= 400) {
    throw new Error(`HTTP ${res.statusCode} for ${url}`);
  }

  const text = await res.body.text();
  return { text, statusCode: res.statusCode, finalUrl: url };
}

/** Run tasks with a fixed concurrency pool. */
export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    for (;;) {
      const i = nextIndex;
      nextIndex += 1;
      if (i >= items.length) return;
      results[i] = await fn(items[i]!, i);
    }
  }

  const workers = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: workers }, () => worker()));
  return results;
}
