import { posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';

const FRONTEND_DIR = fileURLToPath(new URL('..', new URL('.', import.meta.url)));
const CONFIG_FILE = fileURLToPath(new URL('../../eslint.config.mjs', import.meta.url));

const eslint = new ESLint({ cwd: FRONTEND_DIR, overrideConfigFile: CONFIG_FILE });

export interface LintIssue {
  ruleId: string | null;
  severity: number;
  message: string;
}

export async function lintAt(filePath: string, code: string): Promise<LintIssue[]> {
  const [result] = await eslint.lintText(code, { filePath });
  return (result?.messages ?? []).map(({ ruleId, severity, message }) => ({ ruleId, severity, message }));
}

export async function ruleIdsAt(filePath: string, code: string): Promise<(string | null)[]> {
  return (await lintAt(filePath, code)).map((issue) => issue.ruleId);
}

// .vue 文件把代码放进 <script lang="ts">；其他文件原样返回。
export function asFileSource(filePath: string, script: string): string {
  if (!filePath.endsWith('.vue')) {
    return `${script}\n`;
  }
  return `<script lang="ts">\n${script}\n</script>\n<template>\n  <div />\n</template>\n`;
}

// 从 fromFile 所在目录指向 src/ 下 target 的相对导入写法（posix 风格，带 ./ 或 ../ 前缀）。
export function relativeSpecifier(fromFile: string, target: string): string {
  const relative = posix.relative(posix.dirname(fromFile), target);
  return relative.startsWith('.') ? relative : `./${relative}`;
}
