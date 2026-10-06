// 错误码契约测试骨架：真实读取并解析 docs/12-api-contract.md 第 3 节表格。
// FE-1 加入与 api/types.ts、utils/errorMessages.ts 的双向比对。
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { parseErrorCodeTable } from './helpers/errorCodeTable';

const CONTRACT_PATH = fileURLToPath(new URL('../../docs/12-api-contract.md', import.meta.url));
const table = parseErrorCodeTable(readFileSync(CONTRACT_PATH, 'utf8'));

describe('docs/12 第 3 节错误码表', () => {
  it('表格至少有一行数据', () => {
    expect(table.dataRowCount).toBeGreaterThan(0);
  });

  it('解析出的条数等于表格数据行数', () => {
    expect(table.rows.length).toBe(table.dataRowCount);
  });

  it('错误码非空', () => {
    for (const row of table.rows) {
      expect(row.code.trim(), `错误码为空：${JSON.stringify(row)}`).not.toBe('');
    }
  });

  it('错误码无重复', () => {
    const codes = table.rows.map((row) => row.code);
    const duplicates = codes.filter((code, index) => codes.indexOf(code) !== index);
    expect(duplicates).toEqual([]);
  });

  it('每行的 HTTP 状态是三位数字', () => {
    for (const row of table.rows) {
      expect(row.httpStatus, `${row.code} 的 HTTP 状态`).toMatch(/^\d{3}$/);
      expect(Number.isInteger(Number(row.httpStatus))).toBe(true);
    }
  });
});
