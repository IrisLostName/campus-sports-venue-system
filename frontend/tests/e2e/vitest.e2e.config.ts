// BE-8 联调入口（BE-8 裁决第 1、9 节）：对运行中的真实后端与静态前端执行，需要先按 tools/ 下的脚本重置并启动。
// 与默认门禁隔离而不跳过任何用例：默认的 vitest.config.ts 只收集 tests/**/*.spec.ts，本配置只收集 tests/e2e/**/*.e2e.ts。
// 用法：pnpm test:e2e:contract | test:e2e:walkthrough | test:e2e:cors（各对应下面的一个项目）。
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  root: fileURLToPath(new URL('../..', import.meta.url)),
  test: {
    environment: 'node',
    // 共用同一个后端与数据库，文件依次运行；文件内的用例本来就按书写顺序依次运行。
    fileParallelism: false,
    testTimeout: 60000,
    hookTimeout: 120000,
    projects: [
      { extends: true, test: { name: 'contract-http', include: ['tests/e2e/contract/**/*.e2e.ts'] } },
      { extends: true, test: { name: 'walkthrough', include: ['tests/e2e/walkthrough/**/*.e2e.ts'], testTimeout: 180000 } },
      { extends: true, test: { name: 'cors', include: ['tests/e2e/cors/**/*.e2e.ts'] } },
    ],
  },
})
