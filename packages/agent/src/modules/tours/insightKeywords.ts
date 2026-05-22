import type { TravelInsight } from '../../types/insight.js';

/**
 * Compact RU+EN stop-word list. We deliberately keep it small to favour recall:
 * over-aggressive stop-listing on a short `travelAngle` (1–2 informative words)
 * can wipe out the topic signal completely.
 */
const STOP_WORDS = new Set<string>([
  // Russian — most common particles, pronouns, prepositions, auxiliaries.
  'для', 'это', 'или', 'что', 'как', 'без', 'между', 'через', 'около', 'над', 'под',
  'после', 'перед', 'если', 'когда', 'тогда', 'теперь', 'сейчас', 'который',
  'которая', 'которые', 'которых', 'этого', 'этим', 'этой', 'этих', 'такой',
  'такая', 'такие', 'свой', 'свою', 'своих', 'своими', 'был', 'была', 'были',
  'есть', 'будет', 'будут', 'был', 'тоже', 'также', 'может', 'можно', 'нужно',
  'надо', 'куда', 'откуда', 'почему', 'зачем', 'один', 'одна', 'одно', 'один',
  'много', 'наш', 'наша', 'наше', 'наши', 'весь', 'вся', 'все', 'всех',
  // Russian — domain noise (we ARE talking about travel by definition, so these add no signal)
  'тур', 'туры', 'туров', 'туром', 'турами', 'турах', 'тура', 'туре',
  'путешествие', 'путешествия', 'путешествий', 'путешествием',
  'поездка', 'поездки', 'поездок', 'поездку', 'поездкой', 'поездке',
  'отдых', 'отдыха', 'отдыху', 'отдыхом', 'отдыхе',
  'отпуск', 'отпуска', 'отпуске', 'отпуском',
  // English — common stop-words + domain noise
  'the', 'and', 'for', 'with', 'from', 'into', 'about', 'over', 'after', 'before',
  'between', 'through', 'have', 'has', 'had', 'this', 'that', 'these', 'those',
  'tour', 'tours', 'trip', 'trips', 'travel', 'visit', 'visits',
]);

const MIN_TOKEN_LENGTH = 4;
const STEM_LENGTH = 6;

/**
 * Lowercases and strips non-letter/non-digit characters (keeping word boundaries).
 * Works for cyrillic + latin via Unicode property classes.
 */
export function normalizeText(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s\-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(text: string | null | undefined): string[] {
  const n = normalizeText(text);
  if (!n) return [];
  return n.split(/[\s\-]+/).filter(Boolean);
}

/**
 * Very light stemmer: just truncate to first `STEM_LENGTH` characters.
 *
 * Pros: works for both Russian (suffix-rich morphology) and English (-ing/-ed)
 * without language detection. "термальный" / "термальные" / "термальная"
 * → all stem to "термал". "rapidly" / "rapid" → both keep "rapidl"/"rapid".
 *
 * Cons: loses precision for short words (≤ 6 chars stay as-is). Good enough
 * for our use-case where we just need overlap signal in titles / tags / descs.
 */
export function stemToken(word: string): string {
  return word.length <= STEM_LENGTH ? word : word.slice(0, STEM_LENGTH);
}

/**
 * Tokenize, stem each token, and join back to a normalized stemmed string.
 * Used as a comparison-friendly form of any free text — substring
 * `includes(stemmedNeedle)` then becomes morphology-aware ("Каппадокия"
 * matches "в Каппадокии" and "Каппадокию").
 */
export function stemText(text: string | null | undefined): string {
  return tokenize(text).map(stemToken).join(' ');
}

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

function extractStemsFromText(text: string | null | undefined): string[] {
  return tokenize(text)
    .filter((t) => t.length >= MIN_TOKEN_LENGTH)
    .filter((t) => !STOP_WORDS.has(t))
    .map(stemToken);
}

/**
 * Known major destinations grouped by country. Used to detect city/region
 * mentions in `shortSummary` that the LLM may have omitted from the
 * structured `insight.city` field. Boosting tours whose title/locations
 * contain these names dramatically improves topic relevance for news like
 * "open a new spa in Pamukkale" where the LLM filled country=Турция but
 * left city empty.
 */
export const DESTINATIONS_BY_COUNTRY: Record<string, string[]> = {
  'турция': [
    'стамбул', 'анталья', 'каппадокия', 'памуккале', 'бодрум', 'фетхие',
    'мармарис', 'аланья', 'кемер', 'кушадасы', 'олюдениз', 'сиде', 'белек',
  ],
  'грузия': [
    'тбилиси', 'батуми', 'кутаиси', 'местиа', 'степанцминда', 'казбеги',
    'мцхета', 'сванетия', 'кахетия', 'боржоми',
  ],
  'таиланд': ['пхукет', 'бангкок', 'паттайя', 'самуи', 'краби', 'чиангмай', 'пхипхи'],
  'оаэ': ['дубай', 'абу-даби', 'шарджа', 'фуджейра', 'рас-эль-хайма'],
  'египет': ['каир', 'хургада', 'шарм-эль-шейх', 'марса-алам', 'дахаб', 'нувейба'],
  'мальдивы': ['мале', 'хулумале'],
  'индонезия': ['бали', 'джакарта', 'ява', 'ломбок', 'убуд', 'нуса-дуа', 'кута'],
  'вьетнам': ['ханой', 'нячанг', 'хошимин', 'фукуок', 'муйне', 'далат', 'хойан'],
  'шри-ланка': ['коломбо', 'канди', 'элла', 'галле', 'мирисса'],
  'марокко': ['марракеш', 'касабланка', 'фес', 'танжер', 'эс-сувейра', 'шавен', 'агадир'],
  'италия': [
    'рим', 'милан', 'венеция', 'флоренция', 'тоскана', 'сицилия',
    'сардиния', 'неаполь', 'амальфи', 'верона', 'болонья',
  ],
  'испания': [
    'барселона', 'мадрид', 'севилья', 'валенсия', 'малага', 'канары',
    'тенерифе', 'майорка', 'ибица', 'гранада',
  ],
  'франция': ['париж', 'марсель', 'ницца', 'прованс', 'лион', 'бордо', 'канны'],
  'греция': ['афины', 'санторини', 'миконос', 'крит', 'родос', 'корфу', 'халкидики'],
  'кипр': ['ларнака', 'пафос', 'лимассол', 'айя-напа', 'никосия'],
  'черногория': ['будва', 'котор', 'тиват', 'герцег-нови', 'бар'],
  'хорватия': ['дубровник', 'сплит', 'загреб', 'хвар', 'ровинь'],
  'армения': ['ереван', 'дилижан', 'севан', 'гюмри', 'татев'],
  'азербайджан': ['баку', 'габала', 'шеки'],
  'узбекистан': ['ташкент', 'самарканд', 'бухара', 'хива'],
  'киргизия': ['бишкек', 'иссык-куль', 'каракол'],
  'россия': [
    'москва', 'санкт-петербург', 'сочи', 'калининград', 'алтай', 'байкал',
    'камчатка', 'карелия', 'мурманск', 'крым', 'кавказ', 'кисловодск',
    'эльбрус', 'дагестан', 'архыз', 'роза-хутор', 'красная-поляна',
  ],
};

/**
 * Detect known cities/regions of `country` mentioned anywhere in `text`.
 *
 * Uses stem-vs-stem substring matching so Russian declensions don't break
 * the lookup ("в Каппадокии" / "Каппадокию" / "Каппадокия" all match the
 * dictionary entry "каппадокия"). Returns the canonical names (pre-stem)
 * from the dictionary, so callers can still log/display them legibly.
 */
export function detectCitiesInText(text: string | null | undefined, country: string | null | undefined): string[] {
  if (!text || !country) return [];
  const key = normalizeText(country);
  const dictionary = DESTINATIONS_BY_COUNTRY[key];
  if (!dictionary || dictionary.length === 0) return [];
  const haystackStems = stemText(text);
  return dictionary.filter((c) => {
    const cityStem = stemToken(normalizeText(c));
    return cityStem.length > 0 && haystackStems.includes(cityStem);
  });
}

export interface InsightKeywords {
  /** High-signal keywords (travelAngle, audience, season, region/city, detected cities). */
  primary: string[];
  /** Lower-signal keywords from the first sentence of shortSummary. */
  secondary: string[];
  /** Detected city/region names (pre-stem) for direct location boosting. */
  detectedLocations: string[];
}

/**
 * Extract topical signal from a TravelInsight: tokenized, stop-word-filtered,
 * lightly stemmed. Splits into "primary" (high-weight) and "secondary"
 * (low-weight) buckets used by the tour ranker.
 */
export function extractInsightKeywords(insight: TravelInsight): InsightKeywords {
  const detected = detectCitiesInText(insight.shortSummary, insight.country);

  const primaryRaw = [
    ...extractStemsFromText(insight.travelAngle),
    ...extractStemsFromText(insight.targetAudience),
    ...extractStemsFromText(insight.seasonality),
    ...extractStemsFromText(insight.region),
    ...extractStemsFromText(insight.city),
    ...detected.map(stemToken),
  ];
  const primary = uniq(primaryRaw);

  // Take only the first sentence of summary to avoid drowning in narrative tokens.
  const firstSentence = (insight.shortSummary ?? '').split(/(?<=[.!?])\s+/)[0] ?? '';
  const secondary = uniq(extractStemsFromText(firstSentence)).filter(
    (t) => !primary.includes(t),
  );

  return { primary, secondary, detectedLocations: detected };
}

/**
 * Count how many of the given stems are present (as substrings) inside
 * the normalized form of `text`. Each stem can match at most once per call.
 */
export function countStemMatches(text: string, stems: string[]): number {
  if (!text || stems.length === 0) return 0;
  const haystack = normalizeText(text);
  if (!haystack) return 0;
  let hits = 0;
  for (const s of stems) {
    if (s && haystack.includes(s)) hits += 1;
  }
  return hits;
}
