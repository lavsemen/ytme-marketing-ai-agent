import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['packages/agent/tests/**/*.test.ts'],
    globals: false,
    reporters: 'default',
  },
});
