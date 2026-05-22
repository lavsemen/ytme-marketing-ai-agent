import type { Tour } from '../../types/tour.js';
import type { TravelInsight } from '../../types/insight.js';
import type { MarketingPost } from '../../types/post.js';
import type { NewsItem } from '../../types/news.js';
import type { LandingContent } from '../../types/landingContent.js';

export interface LandingTemplateContext {
  slug: string;
  url: string;
  post: MarketingPost;
  insight: TravelInsight;
  news: NewsItem;
  tours: Tour[];
  content: LandingContent;
  heroImageUrl?: string;
}

const YT_BASE = 'https://youtravel.me';
const ESIM_URL = 'https://esimsale.com/ru/';
const ESIM_PROMO_CODE = 'YOUTRAVEL';
const SHARED_PREFIX = '../_shared';

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(input: string): string {
  return escapeHtml(input);
}

function paragraphs(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('\n          ');
}

function transliterate(input: string): string {
  const map: Record<string, string> = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'yo', ж: 'zh', з: 'z',
    и: 'i', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
    с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch',
    ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
  };
  return input
    .toLowerCase()
    .split('')
    .map((c) => map[c] ?? c)
    .join('');
}

function collectionUrlFor(country: string): string {
  const slug = transliterate(country).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return `${YT_BASE}/tours/country/${encodeURIComponent(country)}${slug ? '' : ''}`;
}

function flightsUrlFor(): string {
  return 'https://www.aviasales.ru/';
}

function ratingHtml(tour: Tour): string {
  if (!tour.rating) return '';
  return `<span class="tc-rating">★ ${tour.rating.toFixed(1)}</span>`;
}

function tourCardHtml(tour: Tour): string {
  const safeTitle = escapeHtml(tour.title);
  const safeDesc = tour.shortDescription ? escapeHtml(tour.shortDescription) : '';
  const safeUrl = escapeAttr(tour.url);
  const imageUrl = tour.imageUrl ? escapeAttr(tour.imageUrl) : '';
  const price = tour.price ? escapeHtml(tour.price.replace(/^от\s+/i, '')) : '';
  const duration = tour.duration ? escapeHtml(tour.duration) : '';
  const dates =
    tour.dates && tour.dates.length > 0
      ? escapeHtml(tour.dates.slice(0, 2).join(', '))
      : '';

  const metaParts = [duration, dates].filter(Boolean);
  const metaHtml = metaParts
    .map((p, i) =>
      i === 0 ? `<span>${p}</span>` : `<span class="tc-dot"></span><span>${p}</span>`,
    )
    .join('');

  const imageHtml = imageUrl
    ? `<img src="${imageUrl}" alt="${safeTitle}" loading="lazy">`
    : '';

  return `<article class="tour-card">
            <div class="tc-image">
              ${imageHtml}
              <span class="tc-badge">Авторский</span>
              ${ratingHtml(tour)}
            </div>
            <div class="tc-body">
              <h3 class="tc-title">${safeTitle}</h3>
              ${safeDesc ? `<p class="tc-desc">${safeDesc}</p>` : ''}
              ${metaHtml ? `<div class="tc-meta">${metaHtml}</div>` : ''}
              <div class="tc-footer">
                <div class="tc-price">
                  ${price ? `<span class="tc-from">От</span><strong class="tc-amount">${price}</strong>` : ''}
                </div>
                <div class="tc-btns">
                  <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="btn-tc-main">Смотреть тур</a>
                </div>
              </div>
            </div>
          </article>`;
}

function navHtml(): string {
  return `<header class="yt-nav">
        <div class="container nav-inner">
          <a href="${YT_BASE}" class="nav-logo" target="_blank" rel="noopener noreferrer" aria-label="YouTravel.me">
            <img src="${SHARED_PREFIX}/assets/logo-wordmark.svg" alt="YouTravel.me" class="nav-logo-svg" style="filter: brightness(0) invert(1);">
          </a>
          <div class="nav-links">
            <a class="nav-link" href="#tours">Туры</a>
            <a class="nav-link" href="#blog">Блог</a>
            <a class="nav-link" href="#faq">FAQ</a>
          </div>
        </div>
      </header>`;
}

function heroHtml(ctx: LandingTemplateContext): string {
  const { post, content } = ctx;
  const stats = content.heroStats.map((s, i, arr) => {
    const item = `<div class="hero-stat hero-stat-text"><span>${escapeHtml(s.label)}</span></div>`;
    if (i === arr.length - 1) return item;
    return `${item}\n            <div class="hero-divider"></div>`;
  });

  return `<section class="hero-section" data-screen-label="01 Hero">
        <div class="hero-backdrop" aria-hidden="true">
          <div class="hero-circles">
            <div class="hc hc-1"></div>
            <div class="hc hc-2"></div>
          </div>
        </div>
        <div class="container hero-content">
          <div class="hero-eyebrow">${escapeHtml(content.heroEyebrow)}</div>
          <h1 class="hero-h1">${escapeHtml(post.marketingTitle)}</h1>
          <p class="hero-sub">${escapeHtml(content.heroSubtitle)}</p>
          <div class="hero-actions">
            <a href="#tours" class="btn-cta-primary">Смотреть туры</a>
            <a href="${collectionUrlFor(ctx.insight.country)}" target="_blank" rel="noopener noreferrer" class="btn-cta-sec">Вся подборка</a>
          </div>
          <div class="hero-stats">
            ${stats.join('\n            ')}
          </div>
        </div>
      </section>`;
}

function whyNowHtml(content: LandingContent): string {
  const cards = content.whyNowReasons
    .map(
      (r) =>
        `<div class="reason-card" style="--rc-accent: ${escapeAttr(r.accent || '#8600EF')}">
              <div class="rc-bar"></div>
              <h3 class="rc-title">${escapeHtml(r.title)}</h3>
              <p class="rc-body">${escapeHtml(r.body)}</p>
            </div>`,
    )
    .join('\n            ');

  return `<section class="section-white why-now" data-screen-label="02 WhyNow">
        <div class="container">
          <div class="section-eyebrow">${escapeHtml(content.whyNowEyebrow)}</div>
          <h2 class="section-h2">${escapeHtml(content.whyNowTitle)}</h2>
          <div class="grid-4">
            ${cards}
          </div>
        </div>
      </section>`;
}

function toursSectionHtml(ctx: LandingTemplateContext): string {
  const { tours, content, insight } = ctx;
  const cards = tours.map(tourCardHtml).join('\n          ');
  return `<section class="section-bg tours-section" id="tours" data-screen-label="03 Tours">
        <div class="container">
          <div class="section-eyebrow">${escapeHtml(content.toursEyebrow)}</div>
          <h2 class="section-h2">${escapeHtml(content.toursTitle)}</h2>
          <p class="section-lead">${escapeHtml(content.toursLead)}</p>
          <div class="tours-grid">
          ${cards}
          </div>
          <div class="tours-more">
            <a href="${collectionUrlFor(insight.country)}" target="_blank" rel="noopener noreferrer" class="btn-outline">Смотреть все туры в подборке →</a>
          </div>
        </div>
      </section>`;
}

function collectionBlockHtml(ctx: LandingTemplateContext): string {
  const { content, insight, heroImageUrl } = ctx;
  const cover = heroImageUrl
    ? `<img src="${escapeAttr(heroImageUrl)}" alt="${escapeAttr(insight.country)}" class="cc-photo" loading="lazy">`
    : '';

  return `<section class="collection-section" data-screen-label="04 Collection">
        <div class="container collection-inner">
          <div class="collection-text">
            <div class="section-eyebrow light-label">${escapeHtml(content.collectionEyebrow)}</div>
            <h2 class="section-h2 light-text">${escapeHtml(content.collectionTitle)}</h2>
            <p class="collection-desc">${escapeHtml(content.collectionDesc)}</p>
            <a href="${collectionUrlFor(insight.country)}" target="_blank" rel="noopener noreferrer" class="btn-citron">Смотреть всю подборку →</a>
          </div>
          <a href="${collectionUrlFor(insight.country)}" target="_blank" rel="noopener noreferrer" class="collection-card">
            ${cover}
          </a>
        </div>
      </section>`;
}

function howToGetHtml(content: LandingContent): string {
  return `<section class="section-white aviation-section" data-screen-label="05 HowToGet">
        <div class="container aviation-inner">
          <div class="avia-text">
            <div class="section-eyebrow">${escapeHtml(content.howToGetEyebrow)}</div>
            <h2 class="section-h2">${escapeHtml(content.howToGetTitle)}</h2>
            <p class="avia-desc">${escapeHtml(content.howToGetDesc)}</p>
            <a href="${flightsUrlFor()}" target="_blank" rel="noopener noreferrer" class="btn-purple">Посмотреть авиабилеты →</a>
          </div>
        </div>
      </section>`;
}

function esimBlockHtml(content: LandingContent): string {
  return `<section class="esim-section" id="esim" data-screen-label="06 ESIM">
        <div class="container esim-inner">
          <div class="esim-icon-wrap" aria-hidden="true">
            <div class="esim-ring r1"></div>
            <div class="esim-ring r2"></div>
            <svg class="esim-svg" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="14" y="8" width="36" height="48" rx="6" stroke="white" stroke-width="2.5" stroke-opacity="0.9"/>
              <rect x="20" y="14" width="24" height="16" rx="3" fill="white" fill-opacity="0.15" stroke="white" stroke-width="1.5" stroke-opacity="0.6"/>
              <circle cx="32" cy="43" r="6" stroke="white" stroke-width="2" stroke-opacity="0.8"/>
              <circle cx="32" cy="43" r="2.5" fill="white" fill-opacity="0.9"/>
              <line x1="20" y1="34" x2="44" y2="34" stroke="white" stroke-width="1.5" stroke-opacity="0.3"/>
              <line x1="20" y1="38" x2="36" y2="38" stroke="white" stroke-width="1.5" stroke-opacity="0.3"/>
            </svg>
          </div>
          <div class="esim-text">
            <div class="section-eyebrow light-label">${escapeHtml(content.esimEyebrow)}</div>
            <h2 class="section-h2 light-text">${escapeHtml(content.esimTitle)}</h2>
            <p class="esim-desc">${escapeHtml(content.esimDesc)}</p>
            <div class="esim-promo">
              <span class="esim-promo-label">Промокод при регистрации</span>
              <span class="esim-promo-code">${ESIM_PROMO_CODE}</span>
              <span class="esim-promo-bonus">+250 МБ в подарок</span>
            </div>
            <a href="${ESIM_URL}" target="_blank" rel="noopener noreferrer" class="btn-citron">Купить eSIM Just eSIM →</a>
          </div>
        </div>
      </section>`;
}

function blogSectionHtml(content: LandingContent): string {
  const cards = content.blogTeasers
    .map((b) => {
      const href = b.url || `${YT_BASE}/blog/`;
      const tagBg = escapeAttr(b.tagBg || '#F4ECFA');
      const tagColor = escapeAttr(b.tagColor || '#8600EF');
      return `<a href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer" class="blog-card">
              <div class="bc-top" style="background: ${tagBg}">
                <span class="bc-tag" style="color: ${tagColor}">${escapeHtml(b.tag)}</span>
              </div>
              <div class="bc-body">
                <h3 class="bc-title">${escapeHtml(b.title)}</h3>
                <p class="bc-desc">${escapeHtml(b.desc)}</p>
                <span class="bc-read">Читать статью →</span>
              </div>
            </a>`;
    })
    .join('\n            ');

  return `<section class="section-white blog-section" id="blog" data-screen-label="07 Blog">
        <div class="container">
          <div class="section-eyebrow">${escapeHtml(content.blogEyebrow)}</div>
          <h2 class="section-h2">${escapeHtml(content.blogTitle)}</h2>
          <div class="blog-grid">
            ${cards}
          </div>
        </div>
      </section>`;
}

function forWhomHtml(ctx: LandingTemplateContext): string {
  const { content, insight } = ctx;
  const items = content.forWhomItems
    .map(
      (item) =>
        `<div class="fw-item">
              <span class="fw-check">✓</span>
              <span class="fw-text">${escapeHtml(item)}</span>
            </div>`,
    )
    .join('\n            ');

  return `<section class="section-bg for-whom-section" data-screen-label="08 ForWhom">
        <div class="container for-whom-inner">
          <div class="fw-left">
            <div class="section-eyebrow">${escapeHtml(content.forWhomEyebrow)}</div>
            <h2 class="section-h2">${escapeHtml(content.forWhomTitle)}</h2>
            <a href="${collectionUrlFor(insight.country)}" target="_blank" rel="noopener noreferrer" class="btn-purple fw-cta">Найти свой тур →</a>
          </div>
          <div class="fw-list">
            ${items}
          </div>
        </div>
      </section>`;
}

function whyAuthorHtml(content: LandingContent): string {
  const cards = content.whyAuthorCards
    .map(
      (c, i) =>
        `<div class="wa-card">
              <div class="wa-num">${String(i + 1).padStart(2, '0')}</div>
              <h3 class="wa-title">${escapeHtml(c.title)}</h3>
              <p class="wa-body">${escapeHtml(c.body)}</p>
            </div>`,
    )
    .join('\n            ');

  return `<section class="section-white why-author" data-screen-label="09 WhyAuthor">
        <div class="container">
          <div class="section-eyebrow">${escapeHtml(content.whyAuthorEyebrow)}</div>
          <h2 class="section-h2">${escapeHtml(content.whyAuthorTitle)}</h2>
          <div class="wa-grid">
            ${cards}
          </div>
        </div>
      </section>`;
}

function faqHtml(content: LandingContent): string {
  const items = content.faqItems
    .map(
      (item) =>
        `<div class="faq-item">
              <div class="faq-q">
                <span class="faq-q-text">${escapeHtml(item.q)}</span>
                <span class="faq-icon">+</span>
              </div>
              <div class="faq-a-wrap">
                <p class="faq-a">${escapeHtml(item.a)}</p>
              </div>
            </div>`,
    )
    .join('\n            ');

  return `<section class="section-bg faq-section" id="faq" data-screen-label="10 FAQ">
        <div class="container faq-inner">
          <div class="faq-header">
            <div class="section-eyebrow">${escapeHtml(content.faqEyebrow)}</div>
            <h2 class="section-h2">${escapeHtml(content.faqTitle)}</h2>
          </div>
          <div class="faq-list">
            ${items}
          </div>
        </div>
      </section>`;
}

function finalCtaHtml(ctx: LandingTemplateContext): string {
  const { content, insight } = ctx;
  return `<section class="final-cta-section" data-screen-label="11 FinalCTA">
        <div class="container final-cta-inner">
          <div class="fca-content">
            <h2 class="fca-headline">${escapeHtml(content.finalCtaHeadline)}</h2>
            <p class="fca-sub">${escapeHtml(content.finalCtaSub)}</p>
            <div class="fca-actions">
              <a href="#tours" class="btn-cta-primary">Смотреть туры</a>
              <a href="${collectionUrlFor(insight.country)}" target="_blank" rel="noopener noreferrer" class="btn-cta-sec">Открыть подборку</a>
              <a href="${flightsUrlFor()}" target="_blank" rel="noopener noreferrer" class="btn-cta-ghost">Авиабилеты</a>
              <a href="#esim" class="btn-cta-ghost">Купить eSIM</a>
            </div>
          </div>
        </div>
      </section>`;
}

function footerHtml(ctx: LandingTemplateContext): string {
  const { insight, news } = ctx;
  return `<footer class="site-footer">
        <div class="container footer-inner">
          <a href="${YT_BASE}" target="_blank" rel="noopener noreferrer" class="footer-logo" aria-label="YouTravel.me">
            <img src="${SHARED_PREFIX}/assets/logo-wordmark.svg" alt="YouTravel.me" class="footer-logo-svg" style="filter: brightness(0) invert(0.85);">
          </a>
          <div class="footer-links">
            <a href="${collectionUrlFor(insight.country)}" target="_blank" rel="noopener noreferrer">Туры в ${escapeHtml(insight.country)}</a>
            <a href="${flightsUrlFor()}" target="_blank" rel="noopener noreferrer">Авиабилеты</a>
            <a href="${YT_BASE}/blog/" target="_blank" rel="noopener noreferrer">Блог</a>
            <a href="${YT_BASE}/support/" target="_blank" rel="noopener noreferrer">Поддержка</a>
            <a href="${escapeAttr(news.url)}" target="_blank" rel="noopener noreferrer">Источник новости</a>
          </div>
          <div class="footer-copy">© ${new Date().getUTCFullYear()} YouTravel.me</div>
        </div>
      </footer>`;
}

export function buildIndexHtml(ctx: LandingTemplateContext): string {
  const { post, insight, news, heroImageUrl, url } = ctx;

  const ogImage = heroImageUrl ? escapeAttr(heroImageUrl) : '';
  const ogImageMeta = ogImage ? `\n    <meta property="og:image" content="${ogImage}">` : '';
  const twImage = ogImage ? `\n    <meta name="twitter:image" content="${ogImage}">` : '';

  const jsonLd = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.marketingTitle,
    description: post.seoDescription,
    image: heroImageUrl ? [heroImageUrl] : undefined,
    inLanguage: 'ru',
    mainEntityOfPage: url,
    about: { '@type': 'Place', name: insight.country },
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
    <meta name="description" content="${escapeAttr(post.seoDescription)}">

    <meta property="og:type" content="article">
    <meta property="og:title" content="${escapeAttr(post.ogTitle)}">
    <meta property="og:description" content="${escapeAttr(post.ogDescription)}">
    <meta property="og:url" content="${escapeAttr(url)}">
    <meta property="og:locale" content="ru_RU">${ogImageMeta}

    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${escapeAttr(post.ogTitle)}">
    <meta name="twitter:description" content="${escapeAttr(post.ogDescription)}">${twImage}

    <link rel="canonical" href="${escapeAttr(url)}">
    <link rel="stylesheet" href="${SHARED_PREFIX}/colors_and_type.css">
    <link rel="stylesheet" href="${SHARED_PREFIX}/landing.css">
    <link rel="stylesheet" href="styles.css">

    <script type="application/ld+json">${jsonLd}</script>
  </head>
  <body>
      ${navHtml()}
      <main>
        ${heroHtml(ctx)}
        ${whyNowHtml(ctx.content)}
        ${toursSectionHtml(ctx)}
        ${collectionBlockHtml(ctx)}
        ${howToGetHtml(ctx.content)}
        ${esimBlockHtml(ctx.content)}
        ${blogSectionHtml(ctx.content)}
        ${forWhomHtml(ctx)}
        ${whyAuthorHtml(ctx.content)}
        ${faqHtml(ctx.content)}
        ${finalCtaHtml(ctx)}

        <section class="section-white article-source">
          <div class="container">
            <div class="section-eyebrow">Контекст</div>
            <h2 class="section-h2">О чём речь</h2>
            <div class="article-body" style="max-width: 720px; font-size: 15px; line-height: 26px; color: var(--c-text-2);">
              ${paragraphs(post.marketingText)}
              <p style="margin-top: 16px;">
                Источник:
                <a href="${escapeAttr(news.url)}" target="_blank" rel="noopener noreferrer" style="color: var(--c-purple);">${escapeHtml(news.title)}</a>
                — ${escapeHtml(news.sourceName)}
              </p>
            </div>
          </div>
        </section>
      </main>
      ${footerHtml(ctx)}

    <script src="script.js" defer></script>
  </body>
</html>
`;
}

/** Per-landing overrides only. Base styles live in landings/_shared/. */
export function buildStylesCss(): string {
  return `/* Per-landing overrides. Tokens + base styles are loaded from ../_shared/. */
`;
}

export function buildScriptJs(): string {
  return `(function () {
  // Smooth scroll for hash links
  document.querySelectorAll('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var href = a.getAttribute('href');
      if (!href || href.length < 2) return;
      var target = document.querySelector(href);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  // FAQ accordion
  document.querySelectorAll('.faq-item').forEach(function (item) {
    item.addEventListener('click', function () {
      var isOpen = item.classList.toggle('faq-open');
      var icon = item.querySelector('.faq-icon');
      if (icon) icon.textContent = isOpen ? '\u2212' : '+';
    });
  });

  // Nav scroll state
  var nav = document.querySelector('.yt-nav');
  if (nav) {
    var onScroll = function () {
      if (window.scrollY > 50) nav.classList.add('nav-scrolled');
      else nav.classList.remove('nav-scrolled');
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }
})();
`;
}
