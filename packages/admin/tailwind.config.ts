import type { Config } from 'tailwindcss';

/**
 * News2Trip design system tokens mapped to Tailwind theme.
 * Naming kept flat: bg-surface-2, text-ink-secondary, border-line-default, bg-lime-dim.
 * The `brand` alias points to lime so existing `bg-brand`/`text-brand` keep working.
 */
const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Brand alias (kept for backward compatibility with existing components)
        brand: {
          DEFAULT: '#ABC232',
          dark: '#7FA40C',
        },
        // Lime palette
        lime: {
          DEFAULT: '#ABC232',
          dark: '#7FA40C',
          dim: '#1A1F07',
          mid: '#2A3200',
        },
        // Surfaces
        bg: '#0D0D0D',
        surface: {
          1: '#161616',
          2: '#1E1E1E',
          3: '#252525',
          4: '#2E2E2E',
        },
        // Text (foreground)
        ink: {
          primary: '#FFFFFF',
          secondary: '#AAAAAA',
          muted: '#888888',
          faint: '#555555',
        },
        // Borders / lines
        line: {
          subtle: 'rgba(255,255,255,0.06)',
          DEFAULT: 'rgba(255,255,255,0.10)',
          strong: 'rgba(255,255,255,0.18)',
          lime: 'rgba(171,194,50,0.4)',
        },
        // Status
        success: '#ABC232',
        warning: '#E8A020',
        danger: '#E24B4A',
        info: '#378ADD',
      },
      fontFamily: {
        sans: ['Barlow', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"Barlow Condensed"', 'Barlow', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        xxs: ['11px', { lineHeight: '1.5', letterSpacing: '0.04em' }],
      },
      borderRadius: {
        pill: '999px',
      },
      boxShadow: {
        'ds-sm': '0 2px 8px rgba(0,0,0,0.4)',
        'ds-md': '1px 4px 24px rgba(0,0,0,0.5)',
        'ds-lg': '1px 8px 48px rgba(0,0,0,0.6)',
        'lime-glow': '0 4px 24px rgba(171,194,50,0.18)',
      },
      transitionTimingFunction: {
        ds: 'cubic-bezier(0.22,1,0.36,1)',
      },
    },
  },
  plugins: [],
};

export default config;
