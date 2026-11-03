import vue from '@vitejs/plugin-vue';
import { configDefaults, defineConfig } from 'vitest/config';

import { homeGallery } from './build/galleryPlugin.ts';

export default defineConfig({
  // UI-6：首页图集的虚拟模块，组件测试挂载 HomeView 时同样需要。
  plugins: [vue(), homeGallery()],
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
