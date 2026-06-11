export interface CatalogPagePreview {
  url: string;
  title: string;
  pageClass: string;
  pageType: string;
  purpose: string;
  tourCount?: number;
}

const HUB_PURPOSE = 'Хабовая техническая страница';

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

export function parseCatalogCsv(csvText: string): CatalogPagePreview[] {
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

  const pages: CatalogPagePreview[] = [];
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

export function filterCatalogPages(pages: CatalogPagePreview[]): CatalogPagePreview[] {
  return pages.filter((p) => p.purpose !== HUB_PURPOSE);
}

export async function gzipCsvToBase64(csvText: string): Promise<string> {
  const blob = new Blob([csvText]);
  const stream = blob.stream().pipeThrough(new CompressionStream('gzip'));
  const buffer = await new Response(stream).arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

export async function gunzipCsvFromBase64(base64: string): Promise<string> {
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Response(stream).text();
}
