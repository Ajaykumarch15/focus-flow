function withOpacity(variableName) {
  return ({ opacityValue }) => {
    if (opacityValue !== undefined) {
      const pct = isNaN(Number(opacityValue)) ? `calc(${opacityValue} * 100%)` : `${Number(opacityValue) * 100}%`;
      return `color-mix(in srgb, var(${variableName}) ${pct}, transparent)`;
    }
    return `var(${variableName})`;
  };
}

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        display: ['"Syne"', 'sans-serif'],
        body: ['"DM Sans"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        brand: {
          50: withOpacity('--color-brand-50'),
          100: withOpacity('--color-brand-100'),
          200: withOpacity('--color-brand-200'),
          300: withOpacity('--color-brand-300'),
          400: withOpacity('--color-brand-400'),
          500: withOpacity('--color-brand-500'),
          600: withOpacity('--color-brand-600'),
          700: withOpacity('--color-brand-700'),
          800: withOpacity('--color-brand-800'),
          900: withOpacity('--color-brand-900'),
        },
        surface: {
          50: withOpacity('--color-surface-50'),
          100: withOpacity('--color-surface-100'),
          200: withOpacity('--color-surface-200'),
          300: withOpacity('--color-surface-300'),
          400: withOpacity('--color-surface-400'),
          500: withOpacity('--color-surface-500'),
          600: withOpacity('--color-surface-600'),
          700: withOpacity('--color-surface-700'),
          800: withOpacity('--color-surface-800'),
          850: withOpacity('--color-surface-850'),
          900: withOpacity('--color-surface-900'),
          950: withOpacity('--color-surface-950'),
        }
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(14,165,233,0.3)' },
          '100%': { boxShadow: '0 0 20px rgba(14,165,233,0.8)' },
        }
      },
      backdropBlur: {
        xs: '2px',
      }
    },
  },
  plugins: [],
}
