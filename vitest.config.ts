import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  // passWithNoTests: this task adds the harness but no tests yet; Task 2 onward adds specs.
  test: { environment: 'node', include: ['tests/**/*.test.ts'], passWithNoTests: true },
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
});
