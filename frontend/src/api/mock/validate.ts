// 请求格式校验（统一阶段顺序中的“格式”阶段）：失败一律 VALIDATION_ERROR，details.fields 为 字段→原因。
import { fail } from './fail'
import { isValidDate, isValidTime } from './timeMath'

export type FieldCheck = [field: string, problem: string | null]

export function collect(checks: FieldCheck[]): void {
  const fields: Record<string, string> = {}
  for (const [field, problem] of checks) {
    if (problem !== null) {
      fields[field] = problem
    }
  }
  if (Object.keys(fields).length > 0) {
    fail('VALIDATION_ERROR', { fields })
  }
}

// 空白的判定与后端逐处一致（台账 S-050）：
// - 格式检查（必填文本非空白、可选文本“空白视为未填”）只认 ASCII 空白，与 Java 正则 \s、\S 一致，全角空格不算空白；
// - 语义判断（原因是否填写、可选文本按 null 保存、关键字是否忽略）同 Java String.isBlank()：
//   Character.isWhitespace，全角空格算空白，NBSP（U+00A0、U+2007、U+202F）不算。
const ASCII_BLANK = /^[ \t\n\v\f\r]*$/
const UNICODE_SEPARATOR = /^[\p{Zs}\p{Zl}\p{Zp}]$/u
const NON_BREAKING = new Set([0xa0, 0x2007, 0x202f])

export function isAsciiBlank(value: string): boolean {
  return ASCII_BLANK.test(value)
}

function isJavaWhitespace(char: string): boolean {
  const code = char.charCodeAt(0)
  if ((code >= 0x09 && code <= 0x0d) || (code >= 0x1c && code <= 0x1f)) {
    return true
  }
  return UNICODE_SEPARATOR.test(char) && !NON_BREAKING.has(code)
}

// Java String.isBlank()。
export function isJavaBlank(value: string): boolean {
  return [...value].every(isJavaWhitespace)
}

// 去掉首尾的 ASCII 空白与控制字符（Java String.trim()：去掉不大于 U+0020 的字符）。
export function asciiTrim(value: string): string {
  let start = 0
  let end = value.length
  while (start < end && value.charCodeAt(start) <= 0x20) start += 1
  while (end > start && value.charCodeAt(end - 1) <= 0x20) end -= 1
  return value.slice(start, end)
}

// 请求中字段为 null 与缺省等价（台账 S-040）。
export function isAbsent(value: unknown): value is undefined | null {
  return value === undefined || value === null
}

export function optional(value: unknown, check: (value: unknown) => string | null): string | null {
  return isAbsent(value) ? null : check(value)
}

// 新建与查询类请求中的可选文本：缺省、null、空白都视为未填，否则只查长度（台账 S-041）。
export function optionalText(value: unknown, maxLength: number): string | null {
  if (isAbsent(value) || (typeof value === 'string' && isAsciiBlank(value))) {
    return null
  }
  return textProblem(value, maxLength)
}

// 与 optionalText 配套：未填（含 String.isBlank() 意义下的空白）的可选文本按 null 保存。
export function blankToNull(value: string | null | undefined): string | null {
  return isAbsent(value) || isJavaBlank(value) ? null : value
}

// 列表关键字：只查长度（按原值 ≤ 50）；空白（isBlank）视为未填，否则去首尾空白（trim）后小写匹配。
export function keywordProblem(value: unknown): string | null {
  return typeof value === 'string' && value.length <= 50 ? null : '长度不能超过 50'
}

export function keywordNeedle(value: string | null | undefined): string | null {
  return isAbsent(value) || isJavaBlank(value) ? null : asciiTrim(value).toLowerCase()
}

export function dateProblem(value: unknown): string | null {
  return isValidDate(value) ? null : '日期格式应为 YYYY-MM-DD'
}

export function timeProblem(value: unknown): string | null {
  return isValidTime(value) ? null : '时刻格式应为 HH:mm'
}

export function intProblem(value: unknown, min = 1, max = Number.MAX_SAFE_INTEGER): string | null {
  const ok = typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max
  return ok ? null : `应为 ${min}–${max} 的整数`
}

export function textProblem(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string' || isAsciiBlank(value)) {
    return '不能为空'
  }
  return value.length > maxLength ? `长度不能超过 ${maxLength}` : null
}

export function oneOfProblem(value: unknown, allowed: readonly string[]): string | null {
  return typeof value === 'string' && allowed.includes(value) ? null : `应为 ${allowed.join('/')} 之一`
}

export function pagingChecks(page: unknown, pageSize: unknown): FieldCheck[] {
  return [
    ['page', optional(page, (value) => intProblem(value, 1))],
    ['pageSize', optional(pageSize, (value) => intProblem(value, 1, 100))],
  ]
}

export function isBlank(value: string | null | undefined): boolean {
  return isAbsent(value) || isJavaBlank(value)
}
