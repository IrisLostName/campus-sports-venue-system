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

export function optional(value: unknown, check: (value: unknown) => string | null): string | null {
  return value === undefined ? null : check(value)
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
  if (typeof value !== 'string' || value.trim() === '') {
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

export function isBlank(value: string | undefined): boolean {
  return value === undefined || value.trim() === ''
}
