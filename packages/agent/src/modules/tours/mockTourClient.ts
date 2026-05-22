import type { TourClient } from './tourClient.js';
import type { Tour, TourSearchInput } from '../../types/tour.js';

const MOCK_TOURS: Tour[] = [
  {
    id: '48212',
    title: 'Китай. Горы Аватара и Гуйлинь',
    url: 'https://youtravel.me/tours/48212',
    imageUrl: 'https://youtravel.me/public/images/tour/media/2024/01/01/avatar-mountains.jpg',
    shortDescription: 'Авторское путешествие по горам Чжанцзяцзе и водным пейзажам Гуйлиня.',
    price: 'от 185 000 ₽',
    rating: 4.9,
    duration: '11 дней',
    dates: ['15 окт 2026', '02 ноя 2026', '20 ноя 2026'],
    country: 'Китай',
    tags: ['Авторский', 'Экскурсионный', 'Природа'],
    reviewsCount: 184,
  },
  {
    id: '51267',
    title: 'Полное погружение в классический Китай: от Пекина до Шанхая',
    url: 'https://youtravel.me/tours/51267',
    imageUrl: 'https://youtravel.me/public/images/tour/media/2024/01/01/classic-china.jpg',
    shortDescription: 'Великая стена, Запретный город, терракотовая армия и набережная Бунд.',
    price: 'от 215 000 ₽',
    rating: 4.8,
    duration: '14 дней',
    dates: ['05 окт 2026', '25 окт 2026'],
    country: 'Китай',
    tags: ['Классический', 'Экскурсионный'],
    reviewsCount: 96,
  },
  {
    id: '44894',
    title: 'Китай: всё самое главное',
    url: 'https://youtravel.me/tours/44894',
    imageUrl: 'https://youtravel.me/public/images/tour/media/2024/01/01/china-highlights.jpg',
    shortDescription: 'Сжатый, насыщенный маршрут для тех, у кого мало времени и много желаний.',
    price: 'от 150 000 ₽',
    rating: 4.7,
    duration: '8 дней',
    dates: ['18 окт 2026'],
    country: 'Китай',
    tags: ['Экскурсионный'],
    reviewsCount: 52,
  },
  {
    id: '60001',
    title: 'Шёлковый путь: от Сианя до Кашгара',
    url: 'https://youtravel.me/tours/60001',
    imageUrl: 'https://youtravel.me/public/images/tour/media/2024/01/01/silk-road.jpg',
    shortDescription: 'Древние города, пустыни и культура уйгуров на западе Китая.',
    price: 'от 240 000 ₽',
    rating: 4.6,
    duration: '12 дней',
    country: 'Китай',
    tags: ['Авторский', 'Приключения'],
    reviewsCount: 28,
  },
  {
    id: '70002',
    title: 'Турция: Стамбул и Каппадокия',
    url: 'https://youtravel.me/tours/70002',
    imageUrl: 'https://youtravel.me/public/images/tour/media/2024/01/01/turkey.jpg',
    shortDescription: 'Полёты на воздушном шаре, пещерные города и Босфор.',
    price: 'от 95 000 ₽',
    rating: 4.7,
    duration: '7 дней',
    country: 'Турция',
    tags: ['Экскурсионный'],
    reviewsCount: 312,
  },
];

export class MockTourClient implements TourClient {
  constructor(private fixtures: Tour[] = MOCK_TOURS) {}

  async search(input: TourSearchInput): Promise<Tour[]> {
    const limit = input.limit ?? 30;
    const country = input.country?.toLowerCase().trim();
    const filtered = country
      ? this.fixtures.filter((t) => t.country?.toLowerCase() === country)
      : this.fixtures;
    return filtered.slice(0, limit);
  }
}
