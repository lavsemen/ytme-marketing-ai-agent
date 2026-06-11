import { getDoc, setDoc } from 'firebase/firestore';
import { refs, type CatalogPagesDoc } from './db';
import {
  filterCatalogPages,
  gzipCsvToBase64,
  gunzipCsvFromBase64,
  parseCatalogCsv,
  type CatalogPagePreview,
} from '../lib/catalogCsv';

export interface CatalogMeta {
  rowCount: number;
  filteredCount: number;
  fileName?: string;
  updatedAt: string;
  preview: CatalogPagePreview[];
}

const DEFAULT_CSV_URL = '/default-catalog-pages.csv';

export async function loadCatalogMeta(): Promise<CatalogMeta | null> {
  const snap = await getDoc(refs.catalogPages());
  if (!snap.exists()) return null;
  const data = snap.data() as CatalogPagesDoc;
  if (!data.csvGzipBase64) return null;

  const csv = await gunzipCsvFromBase64(data.csvGzipBase64);
  const all = parseCatalogCsv(csv);
  const filtered = filterCatalogPages(all);

  return {
    rowCount: data.rowCount,
    filteredCount: data.filteredCount,
    ...(data.fileName ? { fileName: data.fileName } : {}),
    updatedAt: data.updatedAt,
    preview: filtered.slice(0, 5),
  };
}

export async function saveCatalogCsv(file: File): Promise<CatalogMeta> {
  const csvText = await file.text();
  const all = parseCatalogCsv(csvText);
  const filtered = filterCatalogPages(all);
  const doc: CatalogPagesDoc = {
    csvGzipBase64: await gzipCsvToBase64(csvText),
    rowCount: all.length,
    filteredCount: filtered.length,
    fileName: file.name,
    updatedAt: new Date().toISOString(),
  };
  await setDoc(refs.catalogPages(), doc);
  return {
    rowCount: doc.rowCount,
    filteredCount: doc.filteredCount,
    fileName: doc.fileName,
    updatedAt: doc.updatedAt,
    preview: filtered.slice(0, 5),
  };
}

export async function resetCatalogToDefault(): Promise<CatalogMeta> {
  const res = await fetch(DEFAULT_CSV_URL);
  if (!res.ok) {
    throw new Error(`Failed to load default catalog CSV (${res.status})`);
  }
  const csvText = await res.text();
  const all = parseCatalogCsv(csvText);
  const filtered = filterCatalogPages(all);
  const doc: CatalogPagesDoc = {
    csvGzipBase64: await gzipCsvToBase64(csvText),
    rowCount: all.length,
    filteredCount: filtered.length,
    fileName: 'default-catalog-pages.csv',
    updatedAt: new Date().toISOString(),
  };
  await setDoc(refs.catalogPages(), doc);
  return {
    rowCount: doc.rowCount,
    filteredCount: doc.filteredCount,
    fileName: doc.fileName,
    updatedAt: doc.updatedAt,
    preview: filtered.slice(0, 5),
  };
}
