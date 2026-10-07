// 错误码契约测试骨架：真实读取并解析 docs/12-api-contract.md 第 3 节表格。
// FE-1 加入与 api/types.ts、utils/errorMessages.ts 的双向比对。
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { ERROR_CODES, ERROR_HTTP_STATUS } from '../src/api/types';
import { ERROR_MESSAGES, messageFor } from '../src/utils/errorMessages';
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

// ---------- FE-1：与 api/types.ts、utils/errorMessages.ts 的双向比对（docs/16 第 4.4 节） ----------
const docCodes = table.rows.map((row) => row.code);

function difference(left: readonly string[], right: readonly string[]): string[] {
  return left.filter((item) => !right.includes(item));
}

describe('docs/12 第 3 节 ⇄ api/types.ts ERROR_CODES', () => {
  it('文档中的每个错误码都在 ERROR_CODES 中', () => {
    expect(difference(docCodes, ERROR_CODES)).toEqual([]);
  });

  it('ERROR_CODES 中的每个错误码都在文档中', () => {
    expect(difference(ERROR_CODES, docCodes)).toEqual([]);
  });

  it('ERROR_CODES 无重复', () => {
    expect(new Set(ERROR_CODES).size).toBe(ERROR_CODES.length);
  });

  it('ERROR_HTTP_STATUS 的键集合等于 ERROR_CODES', () => {
    const keys = Object.keys(ERROR_HTTP_STATUS);
    expect(difference(keys, ERROR_CODES)).toEqual([]);
    expect(difference(ERROR_CODES, keys)).toEqual([]);
  });

  it('ERROR_HTTP_STATUS 逐行等于文档 HTTP 列', () => {
    const fromTypes = ERROR_CODES.map((code) => `${code}=${ERROR_HTTP_STATUS[code]}`).sort();
    const fromDocs = table.rows.map((row) => `${row.code}=${Number(row.httpStatus)}`).sort();
    expect(fromTypes).toEqual(fromDocs);
  });
});

describe('docs/12 第 3 节 ⇄ utils/errorMessages.ts', () => {
  const messageKeys = Object.keys(ERROR_MESSAGES);

  it('文档中的每个错误码都有中文文案', () => {
    expect(difference(docCodes, messageKeys)).toEqual([]);
  });

  it('文案表中没有文档之外的键', () => {
    expect(difference(messageKeys, docCodes)).toEqual([]);
  });

  it('每条文案都是非空中文文本', () => {
    for (const [code, text] of Object.entries(ERROR_MESSAGES)) {
      expect(text.trim(), `${code} 的文案`).not.toBe('');
      expect(text, `${code} 的文案应含中文`).toMatch(/[一-龥]/);
    }
  });

  it('messageFor：已知错误码取文案表，未知错误码取备用文案，再缺省取 INTERNAL_ERROR 文案', () => {
    expect(messageFor('SLOT_TAKEN', '备用')).toBe(ERROR_MESSAGES.SLOT_TAKEN);
    expect(messageFor('NO_SUCH_CODE', '备用')).toBe('备用');
    expect(messageFor('NO_SUCH_CODE')).toBe(ERROR_MESSAGES.INTERNAL_ERROR);
    expect(messageFor('constructor')).toBe(ERROR_MESSAGES.INTERNAL_ERROR);
  });
});
