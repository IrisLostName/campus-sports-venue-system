// 错误文案契约测试：手工解析 docs/12 第 3 节表格的第三列（含义 / 默认中文文案），逐项与 ERROR_MESSAGES 比较。
// 不使用 tests/helpers/errorCodeTable.ts（该 helper 只解析前两列）。键集合与 HTTP 列的比对在 error-code-table.contract.spec.ts。
// 规划裁决 A10 / N-1 / N-2：只有 RULE_INVALID 与 HAS_HISTORY 两项显式例外，其余必须与文档单元格逐字相同。
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { ERROR_CODES } from '../src/api/types';
import { ERROR_MESSAGES } from '../src/utils/errorMessages';

const CONTRACT_PATH = fileURLToPath(new URL('../../docs/12-api-contract.md', import.meta.url));

// 显式例外：文档单元格不是用户文案，文案取裁决给定的原文。
const EXPLICIT_EXCEPTIONS: Readonly<Record<string, string>> = {
  RULE_INVALID: '开放规则不合法',
  HAS_HISTORY: '该场地有历史预约，只能停用不能删除',
};

interface DocMessageRow {
  code: string;
  cell: string;
}

function section3Lines(markdown: string): string[] {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((line) => /^##\s+3\.\s/.test(line));
  if (start < 0) {
    throw new Error('找不到“## 3.”章节标题');
  }
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => /^##\s/.test(line));
  return end < 0 ? rest : rest.slice(0, end);
}

// 表格行 → 单元格：去掉首尾的 |，按 | 切分并去除空白。
function cellsOf(line: string): string[] {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((cell) => cell.trim());
}

function parseMessageColumn(markdown: string): DocMessageRow[] {
  const tableLines = section3Lines(markdown).filter((line) => line.trim().startsWith('|'));
  const separator = tableLines.findIndex((line) => /^\|[\s:|-]+\|$/.test(line.trim()));
  if (separator < 1) {
    throw new Error('找不到表头与分隔行');
  }
  return tableLines.slice(separator + 1).map((line) => {
    const cells = cellsOf(line);
    const code = /^`([^`]+)`$/.exec(cells[0] ?? '')?.[1];
    const cell = cells[2];
    if (code === undefined || cell === undefined || cell === '') {
      throw new Error(`无法解析错误码表的行（需要错误码列与第三列）：${line}`);
    }
    return { code, cell };
  });
}

const rows = parseMessageColumn(readFileSync(CONTRACT_PATH, 'utf8'));
const messages: Record<string, string> = ERROR_MESSAGES;

describe('docs/12 第 3 节第三列 ⇄ ERROR_MESSAGES 文案内容', () => {
  it('解析出的错误码集合等于 ERROR_CODES（解析不会静默丢行）', () => {
    expect(rows.map((row) => row.code).sort()).toEqual([...ERROR_CODES].sort());
  });

  it('显式例外恰好两项，且都在文档表格中', () => {
    expect(Object.keys(EXPLICIT_EXCEPTIONS).sort()).toEqual(['HAS_HISTORY', 'RULE_INVALID']);
    const docCodes = rows.map((row) => row.code);
    for (const code of Object.keys(EXPLICIT_EXCEPTIONS)) {
      expect(docCodes, `${code} 应在文档表格中`).toContain(code);
    }
  });

  it('非例外的错误码：文案与文档第三列逐字相同', () => {
    const differences = rows
      .filter((row) => !Object.hasOwn(EXPLICIT_EXCEPTIONS, row.code))
      .filter((row) => messages[row.code] !== row.cell)
      .map((row) => `${row.code}: 代码「${messages[row.code]}」≠ 文档「${row.cell}」`);
    expect(differences).toEqual([]);
  });

  it('显式例外取裁决给定的原文', () => {
    for (const [code, expected] of Object.entries(EXPLICIT_EXCEPTIONS)) {
      expect(messages[code], `${code} 的文案`).toBe(expected);
    }
  });
});
