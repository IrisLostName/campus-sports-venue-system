import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // ESLint 首次加载配置与插件在冷缓存或慢磁盘上可能超过 5 秒。
    testTimeout: 30000,
    include: ['tests/**/*.spec.ts'],
  },
});
