// FE-8 L8：RULE_INVALID 的 details.reason 原样接在通用文案后面；其余情形的文案与 messageFor 一致。
import { describe, expect, it } from 'vitest'

import { ApiError } from '../src/api/errors'
import { describeError } from '../src/utils/errorText'
import { messageFor } from '../src/utils/errorMessages'

const BASE = '开放规则不合法'

describe('RULE_INVALID 附原因', () => {
  it('details.reason 是非空字符串：通用文案 + “：” + 原因，原样不改', () => {
    const error = new ApiError(400, 'RULE_INVALID', 'x', { reason: '窗口长度必须是 90 分钟的整数倍' })

    expect(describeError(error)).toEqual({ code: 'RULE_INVALID', message: `${BASE}：窗口长度必须是 90 分钟的整数倍` })
  })

  it('没有 details、没有 reason、reason 为空白或不是字符串：只有通用文案', () => {
    const cases: (Record<string, unknown> | undefined)[] = [
      undefined, {}, { reason: '' }, { reason: '   ' }, { reason: 90 }, { reason: null }, { reason: ['a'] }, { other: '无关' },
    ]

    for (const details of cases) {
      expect(describeError(new ApiError(400, 'RULE_INVALID', 'x', details))).toEqual({ code: 'RULE_INVALID', message: BASE })
    }
  })

  it('通用文案本身没变：messageFor(RULE_INVALID) 仍是“开放规则不合法”', () => {
    expect(messageFor('RULE_INVALID')).toBe(BASE)
  })
})

describe('其他错误码不受影响', () => {
  it('别的错误码即使带 reason 也不附加', () => {
    const error = new ApiError(400, 'VALIDATION_ERROR', 'x', { reason: '不该出现' })

    expect(describeError(error)).toEqual({ code: 'VALIDATION_ERROR', message: messageFor('VALIDATION_ERROR') })
  })

  it('未知错误码用调用方给的备用文案；非 ApiError 按 INTERNAL_ERROR', () => {
    expect(describeError(new ApiError(418, 'SOMETHING_NEW', '备用文案'))).toEqual({ code: 'SOMETHING_NEW', message: '备用文案' })
    expect(describeError(new Error('boom'))).toEqual({ code: 'INTERNAL_ERROR', message: messageFor('INTERNAL_ERROR') })
  })
})
