import { describe, it, expect } from 'vitest';
import {
  FetchDeadlineError,
  isFetchAbortError,
  mapWithConcurrency,
  withSourceDeadline,
} from '../src/modules/news/httpFetch.js';

describe('httpFetch', () => {
  it('mapWithConcurrency runs at most N tasks at once', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const items = [1, 2, 3, 4, 5, 6];

    await mapWithConcurrency(items, 2, async (n) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight -= 1;
      return n * 2;
    });

    expect(maxInFlight).toBeLessThanOrEqual(2);
  });

  it('withSourceDeadline aborts slow work', async () => {
    await expect(
      withSourceDeadline('slow', 20, async (signal) => {
        await new Promise((r) => setTimeout(r, 100));
        if (signal.aborted) throw signal.reason;
        return 'ok';
      }),
    ).rejects.toBeInstanceOf(FetchDeadlineError);
  });

  it('isFetchAbortError recognizes timeout-like errors', () => {
    expect(isFetchAbortError(new FetchDeadlineError('x', 1))).toBe(true);
    expect(
      isFetchAbortError(
        Object.assign(new Error('Headers Timeout Error'), {
          name: 'HeadersTimeoutError',
          code: 'UND_ERR_HEADERS_TIMEOUT',
        }),
      ),
    ).toBe(true);
    expect(isFetchAbortError(new Error('other'))).toBe(false);
  });
});
