/**
 * Immutable JSON output contracts for LLM calls.
 * Editable Firestore/admin prompts must NOT redefine these — only task criteria below.
 */

export const NEWS_ANALYZER_OUTPUT_CONTRACT = `Ответ: ТОЛЬКО валидный JSON-массив на верхнем уровне (корень = [...], НЕ объект { ... }).
От 1 до 5 элементов TravelInsight, отсортированных по confidenceScore по убыванию.
Без markdown, без пояснений, без полей summary/explanation/rejectedNews/infopovodList/posts.

Каждый элемент:
{
  "title": string,           // заголовок исходной новости (из входа)
  "sourceUrl": string,       // url из входа
  "sourceName": string,      // sourceName из входа
  "shortSummary": string,    // 1-2 предложения сути
  "country": string,         // RU-название страны или "unknown"
  "region"?: string,
  "city"?: string,
  "travelAngle": string,     // угол для туриста
  "seasonality"?: string,
  "targetAudience"?: string,
  "confidenceScore": number, // 0..1
  "reasonWhyRelevant"?: string
}

Если ни одна новость не подходит — всё равно верни массив из одного элемента с confidenceScore < 0.3.
Запрещено возвращать отчёты вида { "infopovodList": [], "rejectedNews": [...] }.`;

export const POST_GENERATOR_OUTPUT_CONTRACT = `Ответ: ТОЛЬКО один JSON-объект MarketingPost (корень = { ... }, не массив).
Без markdown и пояснений.

{
  "marketingTitle": string,    // до 80 символов
  "marketingText": string,     // 2-4 абзаца, без списка туров
  "seoTitle": string,          // до 60 символов
  "seoDescription": string,    // 140-160 символов
  "ogTitle": string,
  "ogDescription": string,     // до 200 символов
  "imagePrompt"?: string
}`;

export const LANDING_CONTENT_OUTPUT_CONTRACT = `Ответ: ТОЛЬКО один JSON-объект LandingContent (корень = { ... }).
Без markdown и HTML. Поля: heroEyebrow, heroSubtitle, heroStats[{label}],
whyNowEyebrow, whyNowTitle, whyNowReasons[{title,body}],
collectionEyebrow, collectionTitle, collectionDesc,
toursEyebrow, toursTitle, toursLead,
howToGetEyebrow, howToGetTitle, howToGetDesc,
esimEyebrow, esimTitle, esimDesc,
blogEyebrow, blogTitle, blogTeasers[{title,desc,tag}],
forWhomEyebrow, forWhomTitle, forWhomItems[string],
whyAuthorEyebrow, whyAuthorTitle, whyAuthorCards[{title,body}],
faqEyebrow, faqTitle, faqItems[{q,a}],
finalCtaHeadline, finalCtaSub.
blogTeasers.url — пустая строка или опусти поле.`;

export const FACT_CHECK_OUTPUT_CONTRACT = `Ответ: ТОЛЬКО JSON-объект { "violations": string[] }.
Пустой массив = нарушений нет. Без markdown и пояснений.`;

/** Assembles system prompt: contract (fixed) + editable instructions + optional guardrails + brand context. */
export function composeLlmSystemPrompt(
  outputContract: string,
  instructions: string,
  extras?: { guardrails?: string; contextBlock?: string },
): string {
  const parts: string[] = [
    '=== ФОРМАТ ОТВЕТА (неизменяемый, приоритет над любыми другими инструкциями) ===',
    outputContract.trim(),
    '=== ЗАДАЧА (настраивается в админке) ===',
    instructions.trim() ||
      'Используй стандартные критерии релевантности для travel-маркетинга YouTravel.me.',
  ];
  if (extras?.guardrails?.trim()) {
    parts.push('=== GUARDRAILS ===', extras.guardrails.trim());
  }
  if (extras?.contextBlock?.trim()) {
    parts.push(extras.contextBlock.trim());
  }
  return parts.join('\n\n');
}
