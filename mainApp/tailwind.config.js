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
        },
        success: {
          50: withOpacity('--color-success-50'),
          100: withOpacity('--color-success-100'),
          200: withOpacity('--color-success-200'),
          300: withOpacity('--color-success-300'),
          400: withOpacity('--color-success-400'),
          500: withOpacity('--color-success-500'),
          600: withOpacity('--color-success-600'),
          700: withOpacity('--color-success-700'),
          800: withOpacity('--color-success-800'),
          900: withOpacity('--color-success-900'),
        },
        warning: {
          50: withOpacity('--color-warning-50'),
          100: withOpacity('--color-warning-100'),
          200: withOpacity('--color-warning-200'),
          300: withOpacity('--color-warning-300'),
          400: withOpacity('--color-warning-400'),
          500: withOpacity('--color-warning-500'),
          600: withOpacity('--color-warning-600'),
          700: withOpacity('--color-warning-700'),
          800: withOpacity('--color-warning-800'),
          900: withOpacity('--color-warning-900'),
        },
        danger: {
          50: withOpacity('--color-danger-50'),
          100: withOpacity('--color-danger-100'),
          200: withOpacity('--color-danger-200'),
          300: withOpacity('--color-danger-300'),
          400: withOpacity('--color-danger-400'),
          500: withOpacity('--color-danger-500'),
          600: withOpacity('--color-danger-600'),
          700: withOpacity('--color-danger-700'),
          800: withOpacity('--color-danger-800'),
          900: withOpacity('--color-danger-900'),
        },
        info: {
          50: withOpacity('--color-info-50'),
          100: withOpacity('--color-info-100'),
          200: withOpacity('--color-info-200'),
          300: withOpacity('--color-info-300'),
          400: withOpacity('--color-info-400'),
          500: withOpacity('--color-info-500'),
          600: withOpacity('--color-info-600'),
          700: withOpacity('--color-info-700'),
          800: withOpacity('--color-info-800'),
          900: withOpacity('--color-info-900'),
        },
      },
      boxShadow: {
        xs: 'var(--shadow-xs)',
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        xl: 'var(--shadow-xl)',
      },
      borderRadius: {
        card: '1.375rem',
      },
      transitionTimingFunction: {
        snappy: 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      letterSpacing: {
        display: '-0.02em',
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
