// 分页（docs/12 第 1 节）：page 从 1 起，默认 1；pageSize 默认 20，最大 100。参数合法性在格式阶段已校验。
import type { Page } from '../types'

export const DEFAULT_PAGE_SIZE = 20

export function pageOf<T>(items: T[], page = 1, pageSize = DEFAULT_PAGE_SIZE): Page<T> {
  const start = (page - 1) * pageSize
  return { items: items.slice(start, start + pageSize), page, pageSize, total: items.length }
}
