import slugify from 'slugify';

const RU_TO_EN: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e',
  ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm',
  н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u',
  ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};

function transliterate(input: string): string {
  return input
    .split('')
    .map((ch) => {
      const lower = ch.toLowerCase();
      const mapped = RU_TO_EN[lower];
      if (mapped == null) return ch;
      return ch === lower ? mapped : mapped.toUpperCase();
    })
    .join('');
}

export function generateSlug(input: string, options: { maxLength?: number } = {}): string {
  const maxLength = options.maxLength ?? 80;
  const transliterated = transliterate(input);
  const sluggedRaw = slugify(transliterated, {
    lower: true,
    strict: true,
    locale: 'en',
    trim: true,
  });
  const slugged = sluggedRaw || 'post';

  if (slugged.length <= maxLength) return slugged;
  const trimmed = slugged.slice(0, maxLength);
  const lastDash = trimmed.lastIndexOf('-');
  return lastDash > maxLength * 0.6 ? trimmed.slice(0, lastDash) : trimmed;
}

export function uniqueSlug(base: string, existing: Set<string>): string {
  if (!existing.has(base)) return base;
  let i = 2;
  while (existing.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}
