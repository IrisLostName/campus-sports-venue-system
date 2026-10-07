import { describe, expect, it } from 'vitest';

import { parseErrorCodeTable } from './helpers/errorCodeTable';

const SAMPLE = [
  '## 2. 枚举',
  '| `NOT_THIS_TABLE` | 200 |',
  '## 3. 错误码',
  '说明文字',
  '| code | HTTP | 含义 |',
  '| --- | --- | --- |',
  '| `FIRST_CODE` | 400 | 文案 |',
  '| `SECOND_CODE` | 409 | 文案 |',
  '## 4. 核心数据结构',
  '| `AFTER_TABLE` | 500 | 文案 |',
].join('\n');

describe('parseErrorCodeTable', () => {
  it('只读取第 3 节表格的数据行', () => {
    const table = parseErrorCodeTable(SAMPLE);
    expect(table.dataRowCount).toBe(2);
    expect(table.rows).toEqual([
      { code: 'FIRST_CODE', httpStatus: '400' },
      { code: 'SECOND_CODE', httpStatus: '409' },
    ]);
  });

  it('兼容 CRLF 换行', () => {
    const table = parseErrorCodeTable(SAMPLE.replaceAll('\n', '\r\n'));
    expect(table.rows.map((row) => row.code)).toEqual(['FIRST_CODE', 'SECOND_CODE']);
  });

  it('格式异常的数据行使“解析条数”小于“数据行数”', () => {
    const broken = SAMPLE.replace('| `SECOND_CODE` | 409 |', '| SECOND_CODE | 409 |');
    const table = parseErrorCodeTable(broken);
    expect(table.dataRowCount).toBe(2);
    expect(table.rows.length).toBe(1);
  });

  it('保留非数字的 HTTP 状态原文，交由契约测试判断', () => {
    const table = parseErrorCodeTable(SAMPLE.replace('| 409 |', '| 4xx |'));
    expect(table.rows[1]?.httpStatus).toBe('4xx');
  });

  it('缺少第 3 节时抛错', () => {
    expect(() => parseErrorCodeTable('## 1. 其他\n| a | b |')).toThrow();
  });
});
