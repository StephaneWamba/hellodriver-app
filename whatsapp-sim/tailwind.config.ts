import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        wa: {
          bg: '#e5ddd5',
          panel: '#f0f2f5',
          green: '#25d366',
          teal: '#075e54',
          bubble: '#dcf8c6',
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
