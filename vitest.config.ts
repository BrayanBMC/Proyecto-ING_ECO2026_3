import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const enGitHub =
  (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.GITHUB_ACTIONS === 'true';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    // En GitHub Actions cada prueba fallida aparece como anotación en el resumen del job.
    reporters: enGitHub ? ['default', 'github-actions'] : ['default'],
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.{ts,tsx}', 'tests/property/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/core/**/*.ts'],
      reporter: ['text', 'html'],
      // Sección 7.3 de la propuesta: cobertura mínima del motor financiero.
      thresholds: {
        lines: 95,
        functions: 95,
        statements: 95,
        branches: 90,
      },
    },
  },
});
