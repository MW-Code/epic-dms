// Vitest-Konfiguration fuer das Backend.
// Tests liegen unter tests/, Unit + Integration getrennt.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    // Integration-Tests starten mongodb-memory-server (Download beim ersten
    // Lauf kann etwas dauern), daher grosszuegiges Timeout.
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // Globaler Hook setzt Env-Defaults bevor irgendein Modul required wird.
    setupFiles: ['./tests/setup.js'],
  },
});
