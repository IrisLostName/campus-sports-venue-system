// 反例测试：用 ESLint Node API 证明 no-restricted-imports 在 src/ 下（api/ 除外）真的生效。
import { describe, expect, it } from 'vitest';

import { asFileSource, lintAt, relativeSpecifier, ruleIdsAt } from './helpers/lintFixture';

const RESTRICTED_FILES = [
  'src/App.vue',
  'src/main.ts',
  'src/router/index.ts',
  'src/views/PlaceholderView.vue',
  'src/views/user/HomeView.vue',
  'src/views/venue-admin/AdminDashboard.vue',
  'src/views/sys-admin/AdminDashboard.vue',
  'src/views/display/DisplayScreen.vue',
  'src/components/DockBar.vue',
  'src/stores/auth.ts',
  'src/utils/errorMessages.ts',
];

const FORBIDDEN_TARGETS = [
  'src/api/mock',
  'src/api/mock/index',
  'src/api/mock/seed/venues',
  'src/api/http',
  'src/api/http/client',
  'src/api/http.js',
  'src/api/http.ts',
  'src/api/mock.js',
  'src/api/mock.ts',
  'src/api/http/client.js',
  'src/api/mock/index.ts',
];

const ALLOWED_TARGETS = [
  'src/api/index',
  'src/api/index.js',
  'src/api/index.ts',
  'src/api/types',
  'src/api/types.ts',
  'src/api/httpClient',
  'src/api/mockData',
];

const FORBIDDEN_PACKAGES = ['axios', 'axios/lib/axios'];

const cases = RESTRICTED_FILES.flatMap((file) =>
  FORBIDDEN_TARGETS.map((target) => ({ file, specifier: relativeSpecifier(file, target) })),
);

describe('src/ 下 api/ 以外的文件禁止导入 api/mock 与 api/http', () => {
  it.each(cases)('$file 导入 $specifier 报 no-restricted-imports', async ({ file, specifier }) => {
    const source = asFileSource(file, `import '${specifier}';`);
    expect(await ruleIdsAt(file, source)).toEqual(['no-restricted-imports']);
  });

  it.each(cases)('$file 从 $specifier 的 import type 也被禁止', async ({ file, specifier }) => {
    const source = asFileSource(file, `import type { Seed } from '${specifier}';\nexport type Alias = Seed;`);
    expect(await ruleIdsAt(file, source)).toEqual(['no-restricted-imports']);
  });

  it.each(cases)('$file 从 $specifier 的 export from 也被禁止', async ({ file, specifier }) => {
    const source = asFileSource(file, `export * from '${specifier}';`);
    expect(await ruleIdsAt(file, source)).toEqual(['no-restricted-imports']);
  });

  it.each(RESTRICTED_FILES)('%s 经 api/index 与 api/types 导入不报错', async (file) => {
    const lines = ALLOWED_TARGETS.map((target) => `import '${relativeSpecifier(file, target)}';`);
    expect(await ruleIdsAt(file, asFileSource(file, lines.join('\n')))).toEqual([]);
  });
});

describe('src/ 下 api/ 以外的文件禁止导入 axios', () => {
  const axiosCases = RESTRICTED_FILES.flatMap((file) =>
    FORBIDDEN_PACKAGES.map((specifier) => ({ file, specifier })),
  );

  it.each(axiosCases)('$file 导入 $specifier 报 no-restricted-imports', async ({ file, specifier }) => {
    const source = asFileSource(file, `import '${specifier}';`);
    expect(await ruleIdsAt(file, source)).toEqual(['no-restricted-imports']);
  });
});

describe('动态 import() 同样被禁止', () => {
  const dynamicCases = [
    { file: 'src/App.vue', specifier: './api/mock' },
    { file: 'src/main.ts', specifier: './api/http/client' },
    { file: 'src/views/user/HomeView.vue', specifier: '../../api/mock/index' },
    { file: 'src/stores/auth.ts', specifier: 'axios' },
  ];

  it.each(dynamicCases)('$file 动态导入 $specifier 报 no-restricted-syntax', async ({ file, specifier }) => {
    const source = asFileSource(file, `export const load = () => import('${specifier}');`);
    expect(await ruleIdsAt(file, source)).toEqual(['no-restricted-syntax']);
  });

  it('动态导入 api/index 不报错', async () => {
    const source = asFileSource('src/main.ts', `export const load = () => import('./api/index');`);
    expect(await ruleIdsAt('src/main.ts', source)).toEqual([]);
  });
});

describe('src/api/ 内的文件允许导入 mock、http 与 axios', () => {
  const apiFiles = ['src/api/index.ts', 'src/api/client.ts', 'src/api/mock/index.ts', 'src/api/http/client.ts'];

  it.each(apiFiles)('%s 不报 no-restricted-imports', async (file) => {
    const lines = [
      `import '${relativeSpecifier(file, 'src/api/mock/index')}';`,
      `import '${relativeSpecifier(file, 'src/api/http/client')}';`,
      `import 'axios';`,
    ];
    const issues = await lintAt(file, asFileSource(file, lines.join('\n')));
    expect(issues).toEqual([]);
  });

  it('src/api/index.ts 动态导入 mock 与 axios 不报错', async () => {
    const file = 'src/api/index.ts';
    const source = `void import('./mock/index');
void import('axios');
`;
    expect(await ruleIdsAt(file, source)).toEqual([]);
  });
});
