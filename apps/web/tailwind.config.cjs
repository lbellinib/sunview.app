const tokens = require('../../packages/design-tokens/src/tokens.json');

module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        surface: 'var(--color-surface)',
        'surface-elevated': 'var(--color-surface-elevated)',
        text: 'var(--color-text)',
        muted: 'var(--color-muted)',
        accent: 'var(--color-accent)',
        'accent-muted': 'var(--color-accent-muted)',
        'grid-past': 'var(--color-grid-past)',
        'grid-now': 'var(--color-grid-now)',
        'grid-future': 'var(--color-grid-future)',
        'grid-outline': 'var(--color-grid-outline)',
        danger: 'var(--color-danger)'
      },
      fontFamily: {
        sans: ['"Work Sans"', 'system-ui', 'sans-serif']
      },
      borderRadius: {
        sm: 'var(--radius-sm)',
        DEFAULT: 'var(--radius-md)',
        lg: 'var(--radius-lg)'
      },
      spacing: {
        xs: 'var(--space-xs)',
        sm: 'var(--space-sm)',
        md: 'var(--space-md)',
        lg: 'var(--space-lg)',
        xl: 'var(--space-xl)',
        '2xl': 'var(--space-2xl)',
        '3xl': 'var(--space-3xl)'
      },
      animation: {
        pulse: `pulse var(--motion-pulse) ease-in-out infinite`
      }
    }
  },
  plugins: []
};
