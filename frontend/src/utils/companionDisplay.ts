// 同行人名单的展示口径（P2-2c；契约 v1.2）：上限、姓名串、头像首字与确认层的提示文案。
import type { Companion } from '../api/types'

// docs/12 第 5.3 节：companionUserIds 至多 6 个。
export const MAX_COMPANIONS = 6

// GET /users/lookup 的 q ≤ 32。
export const COMPANION_QUERY_MAX_LENGTH = 32

export const COMPANION_TEXTS = {
  label: '同行好友（可选）',
  placeholder: '输入好友的用户名、学号或手机号',
  notFound: '未找到该用户',
  duplicate: '已添加过该好友',
  self: '不能添加自己',
  submitInvalid: '同行好友中有无效或不可用的账号，请检查后重试',
} as const

// 李四、王五；没有同行人时为 null（各显示位置据此不显示这一行）。
export function companionNames(companions: readonly Companion[]): string | null {
  return companions.length === 0 ? null : companions.map((companion) => companion.displayName).join('、')
}

// 头像里的首字（按字符取，不拆开代理对）。
export function initialOf(name: string): string {
  return Array.from(name.trim())[0] ?? '?'
}

export function companionCounter(count: number): string {
  return `已添加 ${count} / ${MAX_COMPANIONS} 位`
}
