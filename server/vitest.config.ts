import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Set before any module (env.ts / db) is imported. dotenv won't override these.
    env: {
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ??
        'postgresql://tasktracker@127.0.0.1:5432/tasktracker_test?schema=public',
      JWT_SECRET: 'test-secret',
      NODE_ENV: 'test',
    },
    setupFiles: ['./tests/setup.ts'],
    fileParallelism: false,
    hookTimeout: 30000,
    testTimeout: 20000,
  },
});
