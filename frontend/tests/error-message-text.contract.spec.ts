// 错误文案契约测试：手工解析 docs/12 第 3 节表格的第三列（含义 / 默认中文文案），逐项与 ERROR_MESSAGES 比较。
// 不使用 tests/helpers/errorCodeTable.ts（该 helper 只解析前两列）。键集合与 HTTP 列的比对在 error-code-table.contract.spec.ts。
// API-SYNC（台账 S-039）起没有例外：29 项全部与文档单元格逐字相同（原 A10 / N-1 / N-2 的两项例外随 API-SYNC 取消）。
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { ERROR_CODES } from '../src/api/types';
import { ERROR_MESSAGES } from '../src/utils/errorMessages';

const CONTRACT_PATH = fileURLToPath(new URL('../../docs/12-api-contract.md', import.meta.url));

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

  it('全部错误码：文案与文档第三列逐字相同', () => {
    const differences = rows
      .filter((row) => messages[row.code] !== row.cell)
      .map((row) => `${row.code}: 代码「${messages[row.code]}」≠ 文档「${row.cell}」`);
    expect(differences).toEqual([]);
  });
});
