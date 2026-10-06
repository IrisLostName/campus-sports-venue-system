// 前端质量门（docs/16 第 4.4 节）。本文件是门禁文件，施工方不得为迎合代码而放宽。
import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import pluginVue from 'eslint-plugin-vue';
import tseslint from 'typescript-eslint';

const API_LAYER_MESSAGE = '页面、组件、store 只能经 api/index 取数据，不得直接导入 api/mock 或 api/http。';
const AXIOS_MESSAGE = '网络请求只允许出现在 src/api 内，不得在其他位置导入 axios。';

const restrictedImports = [
  'error',
  {
    patterns: [
      { regex: '(^|/)api/(mock|http)(/|$)', message: API_LAYER_MESSAGE },
      { regex: '^axios(/|$)', message: AXIOS_MESSAGE },
    ],
  },
];

// no-restricted-imports 不检查动态 import()，这里补上同样的限制。
const restrictedSyntax = [
  'error',
  {
    selector: 'ImportExpression[source.value=/(^|.)api.(mock|http)(.|$)/]',
    message: API_LAYER_MESSAGE,
  },
  {
    selector: 'ImportExpression[source.value=/^axios(.|$)/]',
    message: AXIOS_MESSAGE,
  },
];

export default defineConfig([
  globalIgnores(['dist/**', '.vite/**']),

  js.configs.recommended,
  tseslint.configs.recommended,
  pluginVue.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: { parserOptions: { parser: tseslint.parser } },
  },

  // 行内指令无效：行内禁用注释不能压制规则，出现即告警（lint:check 带 --max-warnings 0）。
  { linterOptions: { noInlineConfig: true } },

  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        { 'ts-ignore': true, 'ts-expect-error': true, 'ts-nocheck': true, 'ts-check': false },
      ],
      'max-lines': ['error', 300],
      complexity: ['error', 12],
    },
  },
  {
    files: ['**/*.ts'],
    rules: { 'max-lines-per-function': ['error', 80] },
  },

  // src/ 下除 src/api/ 以外的全部 .ts 与 .vue（App.vue、main.ts、router、views、components、stores、utils）。
  {
    files: ['src/**/*.{ts,vue}'],
    ignores: ['src/api/**'],
    rules: {
      'no-restricted-imports': restrictedImports,
      'no-restricted-syntax': restrictedSyntax,
    },
  },
]);
