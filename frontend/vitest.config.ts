import vue from '@vitejs/plugin-vue';
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [vue()],
  test: {
    // ESLint 首次加载配置与插件在冷缓存或慢磁盘上可能超过 5 秒。
    testTimeout: 30000,
    projects: [
      {
        extends: true,
        test: {
          name: 'node',
          environment: 'node',
          include: ['tests/**/*.spec.ts'],
          exclude: [...configDefaults.exclude, 'tests/components/**'],
        },
      },
      {
        // 组件测试（QA-1）：只有这个目录使用 DOM 环境。
        extends: true,
        test: {
          name: 'components',
          environment: 'happy-dom',
          include: ['tests/components/**/*.spec.ts'],
        },
      },
    ],
  },
});
