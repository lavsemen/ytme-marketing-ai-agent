import type { Env } from '../../utils/env.js';
import type { TourClient } from './tourClient.js';
import { YouTravelApiClient } from './youtravelClient.js';
import { MockTourClient } from './mockTourClient.js';

export function createTourClient(env: Env): TourClient {
  if (env.TOUR_CLIENT_MODE === 'mock') {
    return new MockTourClient();
  }
  return new YouTravelApiClient({
    baseUrl: env.YOUTRAVEL_API_BASE_URL,
    imageBaseUrl: env.YOUTRAVEL_IMAGE_BASE_URL,
    ...(env.YOUTRAVEL_API_TOKEN ? { token: env.YOUTRAVEL_API_TOKEN } : {}),
  });
}

export { YouTravelApiClient, MockTourClient };
export type { TourClient };
export { rankTours } from './tourRanker.js';
