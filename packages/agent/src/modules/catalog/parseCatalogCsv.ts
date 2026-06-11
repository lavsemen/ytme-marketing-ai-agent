import { gunzipSync, gzipSync } from 'node:zlib';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDb } from '../../db/firestore.js';
import { logger } from '../../utils/logger.js';
import type { CatalogPage } from '../../types/catalogPage.js';

const HUB_PURPOSE = 'Хабовая техническая страница';

const DEFAULT_CSV_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../config/default-catalog-pages.csv',
);

export interface CatalogPagesDoc {
  csvGzipBase64: string;
  rowCount: number;
  filteredCount: number;
  fileName?: string;
  updatedAt: string;
}

/** Parse a single CSV line respecting quoted fields. */
export function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

function parseTourCount(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const s = raw.trim();
  if (!s || s === '#N/A' || s === 'N/A') return undefined;
  const n = Number(s.replace(/\s/g, ''));
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : undefined;
}

export function parseCatalogCsv(csvText: string): CatalogPage[] {
  const lines = csvText.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const header = parseCsvLine(lines[0]!);
  const idx = (name: string) => header.findIndex((h) => h.trim() === name);

  const urlIdx = idx('URL красивый, читаемый и привлекательный');
  const titleIdx = idx('Название страницы');
  const classIdx = idx('Класс страницы');
  const typeIdx = idx('Тип страницы');
  const purposeIdx = idx('Назначение');
  const countIdx = idx('туров на 18.10.25');

  if (urlIdx < 0 || titleIdx < 0 || purposeIdx < 0) {
    throw new Error('CSV missing required columns (URL, Название страницы, Назначение)');
  }

  const pages: CatalogPage[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cols = parseCsvLine(lines[i]!);
    const url = cols[urlIdx]?.trim();
    const title = cols[titleIdx]?.trim();
    const purpose = cols[purposeIdx]?.trim();
    if (!url || !title || !purpose) continue;
    if (!url.startsWith('http')) continue;

    pages.push({
      url,
      title,
      pageClass: cols[classIdx]?.trim() ?? '',
      pageType: cols[typeIdx]?.trim() ?? '',
      purpose,
      ...(parseTourCount(cols[countIdx]) !== undefined
        ? { tourCount: parseTourCount(cols[countIdx]) }
        : {}),
    });
  }
  return pages;
}

export function filterCatalogPages(pages: CatalogPage[]): CatalogPage[] {
  return pages.filter((p) => p.purpose !== HUB_PURPOSE);
}

export function gzipCsvToBase64(csvText: string): string {
  return gzipSync(Buffer.from(csvText, 'utf8')).toString('base64');
}

export function gunzipCsvFromBase64(base64: string): string {
  return gunzipSync(Buffer.from(base64, 'base64')).toString('utf8');
}

export async function readDefaultCatalogCsv(): Promise<string> {
  return readFile(DEFAULT_CSV_PATH, 'utf8');
}

export async function loadDefaultCatalogPages(): Promise<CatalogPage[]> {
  const csv = await readDefaultCatalogCsv();
  return filterCatalogPages(parseCatalogCsv(csv));
}

export async function loadCatalogPagesFromFirestore(): Promise<CatalogPage[] | null> {
  const snap = await getDb().collection('config').doc('catalog-pages').get();
  if (!snap.exists) return null;
  const data = snap.data() as Partial<CatalogPagesDoc>;
  if (!data.csvGzipBase64) return null;
  const csv = gunzipCsvFromBase64(data.csvGzipBase64);
  return filterCatalogPages(parseCatalogCsv(csv));
}

export async function loadCatalogPages(): Promise<CatalogPage[]> {
  try {
    const fromFs = await loadCatalogPagesFromFirestore();
    if (fromFs && fromFs.length > 0) {
      logger.info({ count: fromFs.length }, 'Catalog pages loaded from Firestore');
      return fromFs;
    }
  } catch (err) {
    logger.warn({ err }, 'Failed to load catalog from Firestore — using bundled default');
  }
  const pages = await loadDefaultCatalogPages();
  logger.info({ count: pages.length }, 'Catalog pages loaded from bundled default CSV');
  return pages;
}

export async function saveCatalogPagesDoc(input: {
  csvText: string;
  fileName?: string;
}): Promise<CatalogPagesDoc> {
  const all = parseCatalogCsv(input.csvText);
  const filtered = filterCatalogPages(all);
  const doc: CatalogPagesDoc = {
    csvGzipBase64: gzipCsvToBase64(input.csvText),
    rowCount: all.length,
    filteredCount: filtered.length,
    updatedAt: new Date().toISOString(),
    ...(input.fileName ? { fileName: input.fileName } : {}),
  };
  await getDb().collection('config').doc('catalog-pages').set(doc);
  logger.info({ rowCount: doc.rowCount, filteredCount: doc.filteredCount }, 'Catalog pages saved');
  return doc;
}
