// 读取并拆解 reset-e2e-db.ps1（TEST-2 K5，BE-8 审计 N4）：静态规格与对 postgres 维护库的实测共用。
// 只解析文本，不执行脚本。
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

export const RESET_SCRIPT = fileURLToPath(new URL('./reset-e2e-db.ps1', import.meta.url))

export interface ResetScriptParts {
  text: string
  database: string | null       // $Database = '...' 的字面值
  sql: string                   // @' ... '@ 里的整段 SQL
  guard: string                 // SQL 中的守卫 DO $$ ... $$; 块
  psqlLines: string[]           // 调用 psql 的行
}

function between(text: string, start: string, end: string): string {
  const from = text.indexOf(start)
  const to = from < 0 ? -1 : text.indexOf(end, from + start.length)
  return from < 0 || to < 0 ? '' : text.slice(from + start.length, to)
}

export function readResetScript(path = RESET_SCRIPT): ResetScriptParts {
  const text = readFileSync(path, 'utf8').replace(/\r\n/g, '\n')
  const database = /^\$Database = '([^']*)'$/m.exec(text)?.[1] ?? null
  const sql = between(text, "@'\n", "\n'@")
  const guardStart = sql.indexOf('DO $$')
  const guardEnd = sql.indexOf('$$;', guardStart + 'DO $$'.length)
  const guard = guardStart < 0 || guardEnd < 0 ? '' : sql.slice(guardStart, guardEnd + '$$;'.length)
  const psqlLines = text.split('\n').filter((line) => /^\s*&\s*psql\b/.test(line))
  return { text, database, sql, guard, psqlLines }
}

// 实测只执行守卫块：执行前确认其中没有任何会删除或创建对象的语句。
export function assertHarmless(statement: string): void {
  if (/\b(DROP|CREATE|ALTER|TRUNCATE|DELETE|INSERT|UPDATE)\b/i.test(statement)) {
    throw new Error(`守卫语句里出现了写操作，拒绝执行：${statement}`)
  }
}
