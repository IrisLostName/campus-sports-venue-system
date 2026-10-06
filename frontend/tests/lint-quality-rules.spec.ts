// 反例测试：证明 docs/16 第 4.4 节的 ESLint 规则真的生效，并断言具体规则 id。
// 被禁止的写法用字符串拼接生成，使本文件自身不含这些字面量。
import { describe, expect, it } from 'vitest';

import { asFileSource, lintAt, ruleIdsAt } from './helpers/lintFixture';

const ANY_TYPE = ['an', 'y'].join('');
const TS_DIRECTIVES = ['ignore', 'expect-error', 'nocheck'].map((name) => `@ts-${name}`);
const INLINE_DISABLE = ['eslint', 'disable'].join('-');
const NO_EXPLICIT_ANY_ID = ['@typescript-eslint/no-explicit', ANY_TYPE].join('-');

const TS_FILE = 'src/utils/sample.ts';
const VUE_FILE = 'src/components/SampleBox.vue';

function repeatLines(count: number, line: (index: number) => string): string {
  return Array.from({ length: count }, (_, index) => line(index)).join('\n');
}

describe(NO_EXPLICIT_ANY_ID, () => {
  it.each([TS_FILE, VUE_FILE, 'tests/sample.spec.ts'])('%s 中显式类型转义报错', async (file) => {
    const source = asFileSource(file, `export const value: ${ANY_TYPE} = 1;`);
    expect(await ruleIdsAt(file, source)).toEqual([NO_EXPLICIT_ANY_ID]);
  });
});

describe('@typescript-eslint/ban-ts-comment', () => {
  it.each(TS_DIRECTIVES)('%s 报错', async (directive) => {
    const source = asFileSource(TS_FILE, `// ${directive}\nexport const value = 1;`);
    expect(await ruleIdsAt(TS_FILE, source)).toEqual(['@typescript-eslint/ban-ts-comment']);
  });
});

describe('noInlineConfig：行内指令不能压制规则', () => {
  it('指令本身告警，且被指令覆盖的违规仍然报错', async () => {
    const source = `/* ${INLINE_DISABLE} */\nexport const value: ${ANY_TYPE} = 1;\n`;
    const issues = await lintAt(TS_FILE, source);
    expect(issues.map((issue) => issue.ruleId)).toEqual([null, NO_EXPLICIT_ANY_ID]);
    expect(issues[0]?.severity).toBe(1);
    expect(issues[0]?.message).toContain('noInlineConfig');
  });
});

describe('max-lines 300', () => {
  const build = (count: number): string => `${repeatLines(count, (index) => `export const v${index} = ${index};`)}\n`;

  it.each([TS_FILE, 'tests/sample.spec.ts'])('%s 恰好 300 行通过', async (file) => {
    expect(await ruleIdsAt(file, build(300))).toEqual([]);
  });

  it.each([TS_FILE, 'tests/sample.spec.ts'])('%s 301 行报错', async (file) => {
    expect(await ruleIdsAt(file, build(301))).toEqual(['max-lines']);
  });

  it('.vue 文件超过 300 行报错', async () => {
    const body = repeatLines(300, (index) => `export const v${index} = ${index};`);
    const source = asFileSource(VUE_FILE, body);
    expect(source.split('\n').length).toBeGreaterThan(300);
    expect(await ruleIdsAt(VUE_FILE, source)).toEqual(['max-lines']);
  });
});

describe('complexity 12', () => {
  const build = (branches: number): string => {
    const checks = repeatLines(branches, (index) => `  if (n === ${index}) {\n    result += ${index};\n  }`);
    return `export function score(n: number): number {\n  let result = 0;\n${checks}\n  return result;\n}\n`;
  };

  it('11 个 if（复杂度 12）通过', async () => {
    expect(await ruleIdsAt(TS_FILE, build(11))).toEqual([]);
  });

  it('12 个 if（复杂度 13）报错', async () => {
    expect(await ruleIdsAt(TS_FILE, build(12))).toEqual(['complexity']);
  });

  it('.vue 文件中同样生效', async () => {
    const source = asFileSource(VUE_FILE, build(12));
    expect(await ruleIdsAt(VUE_FILE, source)).toEqual(['complexity']);
  });
});

describe('max-lines-per-function 80（仅 .ts）', () => {
  const build = (totalLines: number): string => {
    const body = repeatLines(totalLines - 4, (index) => `  total += ${index};`);
    return `export function sum(): number {\n  let total = 0;\n${body}\n  return total;\n}\n`;
  };

  it('函数恰好 80 行通过', async () => {
    expect(await ruleIdsAt(TS_FILE, build(80))).toEqual([]);
  });

  it('函数 81 行报错', async () => {
    expect(await ruleIdsAt(TS_FILE, build(81))).toEqual(['max-lines-per-function']);
  });

  it('.vue 文件不受此规则约束', async () => {
    const source = asFileSource(VUE_FILE, build(81));
    expect(await ruleIdsAt(VUE_FILE, source)).toEqual([]);
  });
});
