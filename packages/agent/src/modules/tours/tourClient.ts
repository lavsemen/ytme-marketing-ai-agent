import type { Tour, TourSearchInput } from '../../types/tour.js';

export interface TourClient {
  search(input: TourSearchInput): Promise<Tour[]>;
}

export { type Tour, type TourSearchInput };
