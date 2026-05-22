import { z } from 'zod';

/** LLM sometimes returns null for omitted optional fields; treat as undefined. */
const optionalString = () =>
  z.preprocess((v) => (v === null || v === '' ? undefined : v), z.string().optional());

export const HeroStatSchema = z.object({
  label: z.string().min(1).max(80),
});

export const ReasonCardSchema = z.object({
  title: z.string().min(1).max(80),
  body: z.string().min(1).max(280),
  accent: optionalString(),
});

export const BlogTeaserSchema = z.object({
  title: z.string().min(1).max(120),
  desc: z.string().min(1).max(280),
  tag: z.string().min(1).max(40),
  tagColor: optionalString(),
  tagBg: optionalString(),
  url: optionalString(),
});

export const WhyAuthorCardSchema = z.object({
  title: z.string().min(1).max(60),
  body: z.string().min(1).max(220),
});

export const FaqItemSchema = z.object({
  q: z.string().min(1).max(200),
  a: z.string().min(1).max(800),
});

export const LandingContentSchema = z.object({
  heroEyebrow: z.string().min(1).max(60),
  heroSubtitle: z.string().min(1).max(320),
  heroStats: z.array(HeroStatSchema).min(2).max(4),

  whyNowEyebrow: z.string().min(1).max(40).default('Почему сейчас'),
  whyNowTitle: z.string().min(1).max(120),
  whyNowReasons: z.array(ReasonCardSchema).min(3).max(4),

  collectionEyebrow: z.string().min(1).max(40).default('Весь каталог'),
  collectionTitle: z.string().min(1).max(120),
  collectionDesc: z.string().min(1).max(320),

  toursEyebrow: z.string().min(1).max(40).default('Готовые маршруты'),
  toursTitle: z.string().min(1).max(120),
  toursLead: z.string().min(1).max(320),

  howToGetEyebrow: z.string().min(1).max(40).default('Перелёт'),
  howToGetTitle: z.string().min(1).max(120),
  howToGetDesc: z.string().min(1).max(400),

  esimEyebrow: z.string().min(1).max(40).default('Связь'),
  esimTitle: z.string().min(1).max(120).default('Интернет в поездке без лишней возни'),
  esimDesc: z.string().min(1).max(400),

  blogEyebrow: z.string().min(1).max(40).default('Полезное'),
  blogTitle: z.string().min(1).max(120).default('Почитайте перед поездкой'),
  blogTeasers: z.array(BlogTeaserSchema).min(3).max(4),

  forWhomEyebrow: z.string().min(1).max(40).default('Аудитория'),
  forWhomTitle: z.string().min(1).max(120),
  forWhomItems: z.array(z.string().min(1).max(200)).min(5).max(8),

  whyAuthorEyebrow: z.string().min(1).max(40).default('Формат'),
  whyAuthorTitle: z.string().min(1).max(120).default('Почему с авторским туром проще'),
  whyAuthorCards: z.array(WhyAuthorCardSchema).min(4).max(5),

  faqEyebrow: z.string().min(1).max(40).default('FAQ'),
  faqTitle: z.string().min(1).max(120).default('Частые вопросы'),
  faqItems: z.array(FaqItemSchema).min(4).max(8),

  finalCtaHeadline: z.string().min(1).max(180),
  finalCtaSub: z.string().min(1).max(320),
});

export type HeroStat = z.infer<typeof HeroStatSchema>;
export type ReasonCard = z.infer<typeof ReasonCardSchema>;
export type BlogTeaser = z.infer<typeof BlogTeaserSchema>;
export type WhyAuthorCard = z.infer<typeof WhyAuthorCardSchema>;
export type FaqItem = z.infer<typeof FaqItemSchema>;
export type LandingContent = z.infer<typeof LandingContentSchema>;
