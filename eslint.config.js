// ESLint: sobre todo para detectar nombres no definidos (no-undef), que el build
// de Vite no detecta y que en producción se ven recién como un error en pantalla.
import react from 'eslint-plugin-react';
import hooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default [
  { ignores: ['dist/**', 'node_modules/**', 'manual-privado/**', 'public/**'] },
  {
    files: ['src/**/*.{js,jsx}', 'api/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      // XLSX, jspdf, confetti y ZXingWASM los deja en window la carga bajo demanda.
      globals: { ...globals.browser, ...globals.node, XLSX: 'readonly', ZXingWASM: 'readonly', confetti: 'readonly', jspdf: 'readonly' },
    },
    plugins: { react, 'react-hooks': hooks },
    settings: { react: { version: '18' } },
    rules: {
      'no-undef': 'error',
      'react/jsx-no-undef': 'error',
      'react/jsx-uses-vars': 'error',
      'react/jsx-uses-react': 'error',
      'react-hooks/rules-of-hooks': 'error',
      'no-dupe-keys': 'error',
      'no-redeclare': 'error',
      'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none', varsIgnorePattern: '^_' }],
    },
  },
];
