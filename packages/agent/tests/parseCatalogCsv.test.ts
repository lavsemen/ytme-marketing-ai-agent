import { describe, it, expect } from 'vitest';
import {
  filterCatalogPages,
  gzipCsvToBase64,
  gunzipCsvFromBase64,
  parseCatalogCsv,
  parseCsvLine,
} from '../src/modules/catalog/parseCatalogCsv.js';

const HEADER =
  'Из xml,Класс страницы,Тип страницы,Назначение,"URL красивый, читаемый и привлекательный",Название страницы,Код ответа,Закрыта от индекса,туров на 18.10.25,коммент';

describe('parseCatalogCsv', () => {
  it('parses quoted CSV fields', () => {
    const line = '"a,b",x,"c""d"';
    expect(parseCsvLine(line)).toEqual(['a,b', 'x', 'c"d']);
  });

  it('parses rows and tourCount', () => {
    const csv = `${HEADER}
https://youtravel.me/tours/,хаб,хаб,Хабовая техническая страница,https://youtravel.me/tours/,Главная,200,,#N/A,
https://youtravel.me/tours/continent/китай,континенты,континенты,Целевая страница каталога,https://youtravel.me/tours/continent/китай,Туры в Китай,200,,120,
https://youtravel.me/tours/continent/китай/month-oct,континенты,SEO-фильтр,Месяцы - октябрь,https://youtravel.me/tours/continent/китай/month-oct,Туры в Китай в октябре,200,,#N/A,`;

    const all = parseCatalogCsv(csv);
    expect(all).toHaveLength(3);
    expect(all[1]?.title).toBe('Туры в Китай');
    expect(all[1]?.tourCount).toBe(120);
    expect(all[2]?.tourCount).toBeUndefined();
  });

  it('filters hub pages', () => {
    const csv = `${HEADER}
https://youtravel.me/tours/,хаб,хаб,Хабовая техническая страница,https://youtravel.me/tours/,Главная,200,,,
https://youtravel.me/tours/continent/китай,континенты,континенты,Целевая страница каталога,https://youtravel.me/tours/continent/китай,Туры в Китай,200,,50,`;

    const filtered = filterCatalogPages(parseCatalogCsv(csv));
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.purpose).toBe('Целевая страница каталога');
  });

  it('round-trips gzip base64', () => {
    const csv = `${HEADER}
https://youtravel.me/tours/continent/китай,континенты,континенты,Целевая страница каталога,https://youtravel.me/tours/continent/китай,Туры в Китай,200,,50,`;
    const encoded = gzipCsvToBase64(csv);
    const decoded = gunzipCsvFromBase64(encoded);
    expect(decoded).toBe(csv);
  });
});
