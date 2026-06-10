/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

export default defineConfig({
  server: { port: 5174 },
  test: {
    environment: 'jsdom',
    include: ['test/**/*.spec.ts'],
  },
});
