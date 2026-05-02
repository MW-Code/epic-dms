// Vitest-Konfiguration fuer das Frontend.
// Aktuell: Smoke-Tests fuer reine JS-Helper. Bei Bedarf um @vue/test-utils
// und @vitejs/plugin-vue erweiterbar.
import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
  },
  resolve: {
    alias: {
      src: fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
});
