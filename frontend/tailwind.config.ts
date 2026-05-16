import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
  ],
  corePlugins: {
    // Tldraw가 button/input 등의 default style을 가정. preflight 끄고 우리 스타일만 추가.
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--vd-background))',
        surface:    'hsl(var(--vd-surface))',
        border:     'hsl(var(--vd-border))',
        muted:      'hsl(var(--vd-muted))',
        foreground: 'hsl(var(--vd-foreground))',
        subtle:     'hsl(var(--vd-subtle))',
        faint:      'hsl(var(--vd-faint))',
        accent: {
          DEFAULT: 'hsl(var(--vd-accent))',
          light:   'hsl(var(--vd-accent-light))',
          dark:    'hsl(var(--vd-accent-dark))',
        },
        danger:  'hsl(var(--vd-danger))',
        success: 'hsl(var(--vd-success))',
      },
      borderRadius: {
        sm: '6px',
        DEFAULT: '8px',
        lg: '10px',
        xl: '14px',
      },
      boxShadow: {
        card:   '0 1px 2px rgba(0,0,0,0.04)',
        pop:    '0 2px 6px rgba(0,0,0,0.06)',
        hover:  '0 4px 14px rgba(0,0,0,0.08)',
        accent: '0 2px 6px rgba(255,120,75,0.35), inset 0 1px 0 rgba(255,255,255,0.3)',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}

export default config
