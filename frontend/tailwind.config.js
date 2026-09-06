/** @type {import('tailwindcss').Config} */

// Every colour is a semantic token backed by a CSS custom property defined in
// src/index.css as space-separated RGB channels. That lets Tailwind opacity
// modifiers keep working (bg-primary/10) AND lets the whole palette swap between
// light / dark by only changing the variables under [data-theme="dark"].
const token = (v) => `rgb(var(${v}) / <alpha-value>)`;

export default {
  darkMode: ['selector', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: token('--background'),
        surface: token('--surface'),
        elevated: token('--surface-elevated'),
        card: token('--card'),
        border: {
          DEFAULT: token('--border'),
          strong: token('--border-strong'),
        },
        fg: {
          DEFAULT: token('--text-primary'),
          muted: token('--text-secondary'),
          subtle: token('--text-muted'),
        },
        primary: {
          DEFAULT: token('--primary'),
          hover: token('--primary-hover'),
          foreground: token('--primary-foreground'),
        },
        accent: token('--accent'),
        success: token('--success'),
        warning: token('--warning'),
        danger: token('--danger'),
        critical: token('--critical'),
        ring: token('--ring'),
      },
      fontFamily: {
        sans: ['Inter var', 'Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Arial', 'sans-serif'],
        display: ['Sora', 'Inter var', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.125rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        card: '0 1px 2px rgb(var(--shadow) / 0.06), 0 12px 32px -8px rgb(var(--shadow) / 0.14)',
        pop: '0 24px 70px -12px rgb(var(--shadow) / 0.35)',
        glow: '0 0 0 1px rgb(var(--primary) / 0.30), 0 0 34px -6px rgb(var(--primary) / 0.45)',
        'glow-danger': '0 0 0 1px rgb(var(--critical) / 0.35), 0 0 34px -6px rgb(var(--critical) / 0.45)',
        inset: 'inset 0 1px 0 0 rgb(255 255 255 / var(--inset-hi)), inset 0 -1px 0 0 rgb(var(--shadow) / 0.05)',
      },
      backgroundImage: {
        'grid-fade':
          'linear-gradient(to right, rgb(var(--grid) / 0.6) 1px, transparent 1px), linear-gradient(to bottom, rgb(var(--grid) / 0.6) 1px, transparent 1px)',
        'primary-sheen':
          'linear-gradient(135deg, rgb(var(--primary) / 1), rgb(var(--accent) / 1))',
      },
      backgroundSize: {
        grid: '44px 44px',
      },
      transitionTimingFunction: {
        premium: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      keyframes: {
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        'pulse-ring': {
          '0%': { transform: 'scale(0.9)', opacity: '0.7' },
          '70%': { transform: 'scale(1.6)', opacity: '0' },
          '100%': { opacity: '0' },
        },
        'orb-drift': {
          '0%,100%': { transform: 'translate3d(0,0,0) scale(1)' },
          '50%': { transform: 'translate3d(3%, -4%, 0) scale(1.08)' },
        },
        'bar-eq': {
          '0%,100%': { transform: 'scaleY(0.35)' },
          '50%': { transform: 'scaleY(1)' },
        },
      },
      animation: {
        'pulse-ring': 'pulse-ring 2s cubic-bezier(0.16,1,0.3,1) infinite',
        'orb-drift': 'orb-drift 18s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
