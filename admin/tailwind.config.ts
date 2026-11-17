import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#2DC9A0',
          dark: '#22A882',
          light: '#E8FAF5',
          50: '#EFFCF8',
          100: '#DAF7EE',
        },
        driver: {
          DEFAULT: '#1A73E8',
          dark: '#1557B0',
          light: '#E8F0FE',
        },
        accent: {
          DEFAULT: '#3B5BDB',
          light: '#EEF2FF',
        },
        ink: {
          DEFAULT: '#231F1A',
          soft: '#3D362E',
          deep: '#17130F',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          sunken: '#F7F3EC',
          raised: '#FFFFFF',
        },
        border: {
          DEFAULT: '#EBE4D8',
          strong: '#DCD2C0',
        },
        muted: {
          DEFAULT: '#93897A',
          foreground: '#6E6355',
        },
        success: { DEFAULT: '#27AE60', light: '#E9F9F0' },
        danger: { DEFAULT: '#E5484D', light: '#FDECEC' },
        warning: { DEFAULT: '#F5A623', light: '#FEF6E7' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Fraunces', 'Georgia', 'serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(35, 31, 26, 0.05), 0 1px 8px rgba(35, 31, 26, 0.05)',
        raised: '0 4px 16px rgba(35, 31, 26, 0.10)',
        popover: '0 8px 30px rgba(35, 31, 26, 0.14)',
      },
      borderRadius: {
        xl2: '1.25rem',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-up': { from: { opacity: '0', transform: 'translateY(6px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
      },
      animation: {
        'fade-in': 'fade-in 0.15s ease-out',
        'slide-up': 'slide-up 0.2s ease-out',
      },
    },
  },
  plugins: [],
};

export default config;
