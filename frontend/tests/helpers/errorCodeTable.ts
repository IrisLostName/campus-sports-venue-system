export interface ErrorCodeRow {
  code: string;
  httpStatus: string;
}

export interface ErrorCodeTable {
  dataRowCount: number;
  rows: ErrorCodeRow[];
}

const SECTION_HEADING = /^##\s+3\.\s/;
const NEXT_HEADING = /^##\s/;
const SEPARATOR_ROW = /^\|[\s:|-]+\|$/;
const CODE_ROW = /^\|\s*`([^`]*)`\s*\|\s*([^|]*?)\s*\|/;

function sectionLines(markdown: string): string[] {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((line) => SECTION_HEADING.test(line));
  if (start < 0) {
    throw new Error('找不到“## 3.”章节标题');
  }
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => NEXT_HEADING.test(line));
  return end < 0 ? rest : rest.slice(0, end);
}

// 表格数据行 = 章节内以 | 开头的行，去掉表头行与分隔行。
function tableDataLines(markdown: string): string[] {
  const tableLines = sectionLines(markdown)
    .map((line) => line.trim())
    .filter((line) => line.startsWith('|'));
  const separator = tableLines.findIndex((line) => SEPARATOR_ROW.test(line));
  if (separator < 1) {
    throw new Error('找不到表头与分隔行');
  }
  return tableLines.slice(separator + 1);
}

export function parseErrorCodeTable(markdown: string): ErrorCodeTable {
  const dataLines = tableDataLines(markdown);
  const rows: ErrorCodeRow[] = [];
  for (const line of dataLines) {
    const match = CODE_ROW.exec(line);
    if (match) {
      rows.push({ code: match[1] ?? '', httpStatus: match[2] ?? '' });
    }
  }
  return { dataRowCount: dataLines.length, rows };
}
