import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: '#0a0a0f',
        chip: '#15151f',
        neon: {
          green: '#39ff7a',
          pink: '#ff3ea5',
          gold: '#ffd23f',
          cyan: '#3fe5ff',
        },
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 24px rgba(57, 255, 122, 0.35)',
        pinkglow: '0 0 24px rgba(255, 62, 165, 0.35)',
      },
    },
  },
  plugins: [],
};

export default config;
