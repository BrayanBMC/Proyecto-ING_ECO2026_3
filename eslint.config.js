import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';

export default defineConfig([
  globalIgnores(['dist', 'coverage', 'node_modules', 'playwright-report', 'test-results']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, tseslint.configs.recommended, reactHooks.configs.flat.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
  },
  {
    files: ['*.config.{js,ts}'],
    languageOptions: { globals: globals.node },
  },
  {
    // El motor financiero es un módulo PURO (sección 2 de la propuesta):
    // no puede depender de la UI, de la red ni del almacenamiento.
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['react', 'react-dom', 'react/*', 'react-dom/*'], message: 'src/core no puede importar React.' },
            { group: ['**/ui/**', '**/adapters/**', '**/app/**'], message: 'src/core no puede depender de UI ni adaptadores.' },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'window', message: 'src/core debe ser puro.' },
        { name: 'document', message: 'src/core debe ser puro.' },
        { name: 'fetch', message: 'src/core no hace llamadas de red.' },
        { name: 'localStorage', message: 'src/core no usa almacenamiento.' },
        { name: 'sessionStorage', message: 'src/core no usa almacenamiento.' },
      ],
    },
  },
]);
