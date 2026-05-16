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
    extend: {},
  },
  plugins: [],
}

export default config
