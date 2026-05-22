import path from 'node:path';
import { LANDINGS_DIR, ensureDir, pathExists, writeFile } from '../../utils/fs.js';
import { logger } from '../../utils/logger.js';

const SHARED_DIR = path.join(LANDINGS_DIR, '_shared');
const ASSETS_DIR = path.join(SHARED_DIR, 'assets');

/**
 * Ensures the brand kit (tokens, landing.css, logo) is present under
 * landings/_shared/. Files are committed in the repo, but if any is missing
 * (e.g. fresh clone, manual cleanup), we re-create from these constants so
 * the pipeline never produces a broken landing.
 *
 * We intentionally do NOT overwrite existing files: any edits to the brand
 * kit in the repo are preserved between pipeline runs.
 */
export async function ensureSharedAssets(): Promise<void> {
  await ensureDir(SHARED_DIR);
  await ensureDir(ASSETS_DIR);

  const targets: Array<{ file: string; content: string }> = [
    { file: path.join(SHARED_DIR, 'colors_and_type.css'), content: COLORS_AND_TYPE_CSS },
    { file: path.join(SHARED_DIR, 'landing.css'), content: LANDING_CSS },
    { file: path.join(ASSETS_DIR, 'logo-wordmark.svg'), content: LOGO_WORDMARK_SVG },
  ];

  for (const { file, content } of targets) {
    if (await pathExists(file)) continue;
    await writeFile(file, content);
    logger.info({ file: path.relative(LANDINGS_DIR, file) }, 'Shared asset restored');
  }
}

// ─────────────────────────────────────────────────────────────────────
// Embedded brand kit. Mirrors landings/_shared/* in the repository.
// Keep these in sync if you edit the CSS files manually.
// ─────────────────────────────────────────────────────────────────────

const LOGO_WORDMARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="157.343" height="50.121" viewBox="0 0 157.343 50.121" fill="none">
  <path d="M 9.519 10.461 C 12.14 7.259 14.623 3.892 17.024 0.469 L 14.734 0.469 C 12.885 3.285 10.788 6.211 8.664 8.888 C 6.788 6.045 4.663 3.119 2.511 0.469 L 0 0.469 C 2.842 3.947 5.325 7.259 7.505 10.461 L 7.505 19.708 L 9.519 19.708 L 9.519 10.461 Z M 27.355 20.094 C 33.37 20.094 36.102 17.941 36.102 9.992 C 36.102 2.153 33.343 0 27.355 0 C 21.395 0 18.636 2.153 18.636 9.992 C 18.636 17.941 21.368 20.094 27.355 20.094 Z M 27.355 1.684 C 32.294 1.684 34.005 2.981 34.005 10.047 C 34.005 16.754 32.294 18.355 27.355 18.355 C 22.472 18.355 20.788 16.754 20.788 10.047 C 20.788 2.981 22.472 1.684 27.355 1.684 Z M 55.769 0.469 L 53.782 0.469 L 53.782 13.056 C 53.782 17.444 51.851 18.355 48.043 18.355 C 44.263 18.355 42.276 17.555 42.276 13.056 L 42.276 0.469 L 40.262 0.469 L 40.262 13.028 C 40.262 18.88 43.049 20.094 48.015 20.094 C 53.037 20.094 55.769 18.88 55.769 13.028 L 55.769 0.469 Z M 10.368 50.121 L 10.368 34.029 L 16.853 34.029 L 16.853 30.883 L 0.215 30.883 L 0.215 34.029 L 6.699 34.029 L 6.699 50.121 L 10.368 50.121 Z M 23.016 33.974 L 28.534 33.974 C 29.886 33.974 30.686 34.94 30.686 36.955 C 30.686 38.832 29.859 39.771 28.451 39.771 L 23.016 39.771 L 23.016 33.974 Z M 29.693 41.758 C 33.528 41.62 34.742 39.246 34.742 36.486 C 34.742 33.395 33.446 30.883 29.39 30.883 L 19.374 30.883 L 19.374 50.121 L 23.016 50.121 L 23.016 42.779 L 25.582 42.779 C 26.823 42.779 28.617 44.849 31.625 50.121 L 36.122 50.121 C 32.756 44.491 31.018 42.227 29.693 41.758 Z M 51.74 50.121 L 55.769 50.121 C 53.616 44.987 50.802 37.066 48.843 30.883 L 43.131 30.883 C 40.786 36.624 37.972 44.38 36.178 50.121 L 39.986 50.121 C 40.428 48.658 40.924 47.03 41.476 45.318 L 49.891 45.318 C 50.526 47.085 51.189 48.741 51.74 50.121 Z M 46.167 33.974 C 46.912 36.458 47.85 39.357 48.843 42.2 L 42.442 42.2 C 43.435 39.301 44.456 36.458 45.422 33.974 L 46.167 33.974 Z M 54.71 30.883 C 56.973 36.017 59.787 44.021 61.663 50.121 L 66.326 50.121 C 68.755 44.38 71.597 36.624 73.362 30.883 L 69.527 30.883 C 68.147 35.575 66.133 41.73 64.23 46.423 C 62.822 41.62 60.477 35.078 58.739 30.883 L 54.71 30.883 Z M 75.554 30.883 L 75.554 50.121 L 89.515 50.121 L 89.515 46.975 L 79.196 46.975 L 79.196 41.592 L 86.563 41.592 L 86.563 38.473 L 79.196 38.473 L 79.196 34.029 L 89.515 34.029 L 89.515 30.883 L 75.554 30.883 Z M 92.664 30.883 L 92.664 50.121 L 105.384 50.121 L 105.384 46.947 L 96.306 46.947 L 96.306 30.883 L 92.664 30.883 Z M 111.702 46.036 C 110.101 46.036 109.577 46.284 109.577 47.968 C 109.577 49.79 110.101 50.121 111.702 50.121 C 113.385 50.121 113.909 49.79 113.909 47.968 C 113.909 46.284 113.385 46.036 111.702 46.036 Z M 128.482 43.055 C 126.881 39.053 124.895 34.499 123.074 30.745 L 118.107 30.745 L 118.107 49.983 L 121.611 49.983 L 121.611 35.658 C 123.294 39.357 125.281 44.435 126.771 48.217 L 129.613 48.217 C 131.158 44.435 133.228 39.494 134.966 35.658 L 134.966 49.983 L 138.525 49.983 L 138.525 30.745 L 133.807 30.745 C 132.014 34.444 129.999 39.025 128.482 43.055 Z M 143.382 30.745 L 143.382 49.983 L 157.343 49.983 L 157.343 46.837 L 147.024 46.837 L 147.024 41.454 L 154.391 41.454 L 154.391 38.335 L 147.024 38.335 L 147.024 33.891 L 157.343 33.891 L 157.343 30.745 L 143.382 30.745 Z" fill="currentColor" fill-rule="nonzero"/>
</svg>
`;

const COLORS_AND_TYPE_CSS = `:root {
  --yt-purple-500: #8600EF; --yt-purple-600: #771F96; --yt-purple-700: #5D16B9;
  --yt-citron-500: #ABC232; --yt-citron-600: #9DB319; --yt-citron-700: #7FA40C;
  --yt-fg-1: #242A37; --yt-fg-2: #727281; --yt-fg-3: #9999A9;
  --yt-bd: #DBDFE9; --yt-bg-1: #F0F2F5; --yt-bg-2: #F6F7FA; --yt-surface: #FFFFFF;
  --yt-shadow-card: 1px 3px 60px 0 rgba(153,153,169,0.35);
  --yt-display: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Arial, sans-serif;
  --yt-text:    -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif;
  --yt-mono:    ui-monospace, "SF Mono", Menlo, Consolas, monospace;
}
body.yt { font-family: var(--yt-text); color: var(--yt-fg-1); background: var(--yt-bg-1); -webkit-font-smoothing: antialiased; }
`;

// Mini-version of landing.css for fallback only. Full file lives in landings/_shared/landing.css.
const LANDING_CSS = `/* Fallback brand styles — see landings/_shared/landing.css in the repo for the full version. */
:root { --c-bg: #F0F2F5; --c-surface: #FFFFFF; --c-border: #DBDFE9; --c-text-1: #242A37; --c-text-2: #727281; --c-purple: #8600EF; --c-citron: #9DB319; --nav-h: 68px; }
*,*::before,*::after { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: var(--yt-text); background: var(--c-bg); color: var(--c-text-1); }
.container { max-width: 1240px; margin: 0 auto; padding: 0 32px; }
section { padding: 88px 0; }
.section-h2 { font-family: var(--yt-display); font-size: 32px; font-weight: 700; line-height: 1.15; margin-bottom: 16px; }
.btn-cta-primary { display: inline-flex; align-items: center; height: 48px; padding: 0 26px; border-radius: 10px; background: var(--c-citron); color: #fff; font-weight: 600; }
.tour-card { background: #fff; border-radius: 16px; padding: 20px; box-shadow: 0 2px 12px rgba(0,0,0,.08); }
`;
