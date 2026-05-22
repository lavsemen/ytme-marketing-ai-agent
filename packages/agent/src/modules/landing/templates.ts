import type { Tour } from '../../types/tour.js';
import type { TravelInsight } from '../../types/insight.js';
import type { MarketingPost } from '../../types/post.js';
import type { NewsItem } from '../../types/news.js';

export interface LandingTemplateContext {
  slug: string;
  url: string;
  post: MarketingPost;
  insight: TravelInsight;
  news: NewsItem;
  tours: Tour[];
  heroImageUrl?: string;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function paragraphs(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('\n        ');
}

function tourCardHtml(tour: Tour): string {
  const safeTitle = escapeHtml(tour.title);
  const safeDesc = tour.shortDescription ? escapeHtml(tour.shortDescription) : '';
  const safeUrl = escapeHtml(tour.url);
  const imageUrl = tour.imageUrl ? escapeHtml(tour.imageUrl) : '';
  const ratingHtml = tour.rating
    ? `<span class="tour-card__rating" aria-label="Рейтинг">★ ${tour.rating.toFixed(1)}</span>`
    : '';
  const priceHtml = tour.price ? `<span class="tour-card__price">${escapeHtml(tour.price)}</span>` : '';
  const durationHtml = tour.duration
    ? `<span class="tour-card__duration">${escapeHtml(tour.duration)}</span>`
    : '';
  const datesHtml =
    tour.dates && tour.dates.length > 0
      ? `<div class="tour-card__dates">Ближайшие даты: ${tour.dates
          .slice(0, 3)
          .map((d) => escapeHtml(d))
          .join(', ')}</div>`
      : '';

  const imgHtml = imageUrl
    ? `<img class="tour-card__image" src="${imageUrl}" alt="${safeTitle}" loading="lazy" onerror="this.replaceWith(document.createElement('div')).className='tour-card__image tour-card__image--placeholder'">`
    : `<div class="tour-card__image tour-card__image--placeholder" aria-hidden="true"></div>`;

  return `<article class="tour-card">
          ${imgHtml}
          <div class="tour-card__body">
            <h3 class="tour-card__title">${safeTitle}</h3>
            <div class="tour-card__meta">
              ${ratingHtml}
              ${durationHtml}
              ${priceHtml}
            </div>
            ${safeDesc ? `<p class="tour-card__description">${safeDesc}</p>` : ''}
            ${datesHtml}
            <a class="tour-card__cta" href="${safeUrl}" target="_blank" rel="noopener noreferrer">Смотреть тур</a>
          </div>
        </article>`;
}

export function buildIndexHtml(ctx: LandingTemplateContext): string {
  const { post, insight, news, tours, heroImageUrl, url } = ctx;

  const ogImage = heroImageUrl ? escapeHtml(heroImageUrl) : '';
  const ogImageMeta = ogImage ? `\n    <meta property="og:image" content="${ogImage}">` : '';
  const twImage = ogImage ? `\n    <meta name="twitter:image" content="${ogImage}">` : '';

  const heroBgStyle = heroImageUrl
    ? ` style="background-image: linear-gradient(180deg, rgba(15,23,42,0.45), rgba(15,23,42,0.75)), url('${escapeHtml(heroImageUrl)}');"`
    : '';

  const toursHtml = tours.map(tourCardHtml).join('\n        ');

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.marketingTitle,
    description: post.seoDescription,
    image: heroImageUrl ? [heroImageUrl] : undefined,
    inLanguage: 'ru',
    mainEntityOfPage: url,
    about: {
      '@type': 'Place',
      name: insight.country,
    },
    isBasedOn: {
      '@type': 'NewsArticle',
      url: news.url,
      headline: news.title,
      publisher: { '@type': 'Organization', name: news.sourceName },
    },
  })
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');

  return `<!DOCTYPE html>
<html lang="ru">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(post.seoTitle)}</title>
    <meta name="description" content="${escapeHtml(post.seoDescription)}">

    <meta property="og:type" content="article">
    <meta property="og:title" content="${escapeHtml(post.ogTitle)}">
    <meta property="og:description" content="${escapeHtml(post.ogDescription)}">
    <meta property="og:url" content="${escapeHtml(url)}">
    <meta property="og:locale" content="ru_RU">${ogImageMeta}

    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeHtml(post.ogTitle)}">
    <meta name="twitter:description" content="${escapeHtml(post.ogDescription)}">${twImage}

    <link rel="canonical" href="${escapeHtml(url)}">
    <link rel="stylesheet" href="styles.css">

    <script type="application/ld+json">${jsonLd}</script>
  </head>
  <body>
    <header class="hero"${heroBgStyle}>
      <div class="hero__inner">
        <p class="hero__source">
          <a href="${escapeHtml(news.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(news.sourceName)}</a>
        </p>
        <h1 class="hero__title">${escapeHtml(post.marketingTitle)}</h1>
        <p class="hero__subtitle">${escapeHtml(insight.shortSummary)}</p>
        <a class="hero__cta" href="#tours">Смотреть подборку</a>
      </div>
    </header>

    <main>
      <section class="content">
        ${paragraphs(post.marketingText)}
        <p class="content__source">
          Источник новости:
          <a href="${escapeHtml(news.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(news.title)}</a>
          — ${escapeHtml(news.sourceName)}
        </p>
      </section>

      <section id="tours" class="tours">
        <h2 class="tours__title">Подборка туров${insight.country ? ` в ${escapeHtml(insight.country)}` : ''}</h2>
        <div class="tours__grid">
        ${toursHtml}
        </div>
      </section>

      <section class="cta">
        <h2 class="cta__title">Не нашли свой тур?</h2>
        <p class="cta__text">На YouTravel.me — больше 8000 авторских туров от проверенных гидов.</p>
        <a class="cta__button" href="https://youtravel.me" target="_blank" rel="noopener noreferrer">Открыть YouTravel.me</a>
      </section>
    </main>

    <footer class="footer">
      <p>Подборка подготовлена маркетинговым AI-агентом YouTravel.me</p>
    </footer>

    <script src="script.js" defer></script>
  </body>
</html>
`;
}

export function buildStylesCss(): string {
  return `/* Reset & base */
*, *::before, *::after { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  line-height: 1.55;
  color: #0f172a;
  background: #f8fafc;
  -webkit-font-smoothing: antialiased;
}
img { max-width: 100%; height: auto; display: block; }
a { color: #2563eb; text-decoration: none; }
a:hover { text-decoration: underline; }

/* Hero */
.hero {
  position: relative;
  color: #fff;
  background-color: #1e293b;
  background-size: cover;
  background-position: center;
  padding: 80px 24px 96px;
}
.hero__inner {
  max-width: 880px;
  margin: 0 auto;
  text-align: center;
}
.hero__source { font-size: 14px; opacity: 0.85; margin: 0 0 16px; }
.hero__source a { color: #fff; text-decoration: underline; }
.hero__title {
  font-size: clamp(28px, 5vw, 48px);
  line-height: 1.15;
  margin: 0 0 16px;
  font-weight: 700;
}
.hero__subtitle {
  font-size: clamp(16px, 2vw, 20px);
  opacity: 0.92;
  margin: 0 0 32px;
}
.hero__cta {
  display: inline-block;
  background: #fff;
  color: #0f172a;
  padding: 14px 28px;
  border-radius: 999px;
  font-weight: 600;
  font-size: 16px;
  text-decoration: none;
  transition: transform 0.15s ease;
}
.hero__cta:hover { transform: translateY(-1px); text-decoration: none; }

/* Content */
.content {
  max-width: 720px;
  margin: 0 auto;
  padding: 48px 24px 24px;
  font-size: 17px;
}
.content p { margin: 0 0 18px; }
.content__source {
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid #e2e8f0;
  font-size: 14px;
  color: #475569;
}

/* Tours */
.tours { max-width: 1120px; margin: 0 auto; padding: 32px 24px 48px; }
.tours__title {
  font-size: clamp(22px, 3vw, 32px);
  margin: 0 0 24px;
  font-weight: 700;
}
.tours__grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}
.tour-card {
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08), 0 1px 2px rgba(15, 23, 42, 0.04);
  display: flex;
  flex-direction: column;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}
.tour-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 16px rgba(15, 23, 42, 0.1);
}
.tour-card__image {
  width: 100%;
  height: 180px;
  object-fit: cover;
  background: #e2e8f0;
}
.tour-card__image--placeholder {
  background: linear-gradient(135deg, #cbd5e1 25%, #e2e8f0 50%, #cbd5e1 75%);
}
.tour-card__body { padding: 16px 18px 20px; display: flex; flex-direction: column; flex: 1; }
.tour-card__title { font-size: 17px; margin: 0 0 8px; font-weight: 600; line-height: 1.3; }
.tour-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  font-size: 13px;
  color: #475569;
  margin: 0 0 12px;
}
.tour-card__rating { color: #f59e0b; font-weight: 600; }
.tour-card__price { font-weight: 600; color: #0f172a; }
.tour-card__description { font-size: 14px; color: #334155; margin: 0 0 12px; }
.tour-card__dates { font-size: 13px; color: #64748b; margin: 0 0 16px; }
.tour-card__cta {
  margin-top: auto;
  display: inline-block;
  padding: 10px 16px;
  background: #2563eb;
  color: #fff;
  border-radius: 8px;
  text-align: center;
  font-weight: 600;
  transition: background 0.15s ease;
}
.tour-card__cta:hover { background: #1d4ed8; text-decoration: none; }

/* CTA */
.cta {
  max-width: 720px;
  margin: 0 auto;
  padding: 48px 24px;
  text-align: center;
  border-top: 1px solid #e2e8f0;
}
.cta__title { font-size: 24px; margin: 0 0 12px; }
.cta__text { color: #475569; margin: 0 0 24px; }
.cta__button {
  display: inline-block;
  padding: 14px 28px;
  background: #0f172a;
  color: #fff;
  border-radius: 999px;
  font-weight: 600;
}
.cta__button:hover { text-decoration: none; background: #1e293b; }

/* Footer */
.footer {
  padding: 24px;
  text-align: center;
  font-size: 13px;
  color: #94a3b8;
}

/* Mobile */
@media (max-width: 640px) {
  .hero { padding: 56px 20px 64px; }
  .content { padding: 32px 20px 16px; font-size: 16px; }
  .tours { padding: 24px 16px 40px; }
  .tours__grid { grid-template-columns: 1fr; }
}
`;
}

export function buildScriptJs(): string {
  return `(function () {
  const heroCta = document.querySelector('.hero__cta');
  if (heroCta) {
    heroCta.addEventListener('click', function (e) {
      const href = heroCta.getAttribute('href');
      if (!href || !href.startsWith('#')) return;
      const target = document.querySelector(href);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
})();
`;
}
