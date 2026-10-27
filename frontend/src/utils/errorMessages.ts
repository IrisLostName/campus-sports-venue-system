// docs/12 第 3 节：错误码 → 中文文案。键集合必须与错误码表完全一致（契约测试双向比对）。
import type { ErrorCode } from '../api/types'

export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  VALIDATION_ERROR: '请求参数不合法',
  RULE_INVALID: '开放规则不合法',
  DATE_OUT_OF_RANGE: '超出可预约日期范围',
  AUTH_REQUIRED: '请先登录',
  TOKEN_EXPIRED: '登录已过期，请重新登录',
  INVALID_CREDENTIALS: '用户名或密码错误',
  ACCOUNT_DISABLED: '账号已停用',
  FORBIDDEN: '无权执行此操作',
  FORBIDDEN_SCOPE: '无权操作该场馆',
  NOT_OWNER: '只能操作自己的预约',
  NOT_FOUND: '资源不存在',
  USERNAME_TAKEN: '用户名已被占用',
  VENUE_NOT_BOOKABLE: '该场馆暂未开放预约',
  RESOURCE_UNAVAILABLE: '该场地当前不可预约',
  SLOT_NOT_AVAILABLE: '该时段不存在或未开放',
  SLOT_IN_PAST: '该时段已开始或已过去',
  BOOKING_LIMIT_REACHED: '已达同时持有预约数上限',
  SLOT_TAKEN: '该时段刚刚被别人预约了，请重新选择',
  INVALID_STATE: '当前状态不允许该操作',
  CANCEL_DEADLINE_PASSED: '已超过可取消时间',
  ALREADY_CHECKED_IN: '已签到',
  CHECKIN_WINDOW_CLOSED: '当前不在签到时间内',
  CHECKIN_CODE_INVALID: '签到码无效',
  NOT_CHECKED_IN: '尚未签到',
  ALREADY_CHECKED_OUT: '已签退',
  USER_NOT_ELIGIBLE: '目标用户不可被分配预约',
  REASON_REQUIRED: '请填写原因',
  IMPACT_CONFIRMATION_REQUIRED: '该操作会影响已有预约，请先选择保留或取消',
  // 规划裁决 A10：docs/12 此行为保留码说明，文案依据 docs/03 第 6 节。
  HAS_HISTORY: '该场地有历史预约，只能停用不能删除',
  INTERNAL_ERROR: '服务器开小差了，请稍后再试',
}

// 展示用文案：错误码表 → 调用方给出的备用文案（如服务端 body.message）→ INTERNAL_ERROR 文案。
export function messageFor(code: string, fallback?: string): string {
  const messages: Record<string, string> = ERROR_MESSAGES
  if (Object.hasOwn(messages, code)) {
    return messages[code] ?? ERROR_MESSAGES.INTERNAL_ERROR
  }
  return fallback ?? ERROR_MESSAGES.INTERNAL_ERROR
}
