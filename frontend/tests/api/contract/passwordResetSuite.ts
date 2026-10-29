// 契约套件：v1.3 自助找回密码与注册手机号（docs/12 第 5.1 节 POST /auth/password-reset、POST /auth/register）。由 suite.ts 的 contractSuite 调用。
// 用户名带本套件自己的前缀与序号，与 suite.ts 的 contract_N 互不冲突。旧 Token 失效与“同一秒内”的口径依赖时钟，见 tests/api/mock/passwordReset.spec.ts。
import { describe, expect, it } from 'vitest'

import type { RegisterRequest } from '../../../src/api/requests'
import { expectCode, type ContractTarget } from './contractSupport'

const PHONE = '13800000099'
let sequence = 0

function nextUsername(): string {
  sequence += 1
  return `contract_pr_${sequence}`
}

export function passwordResetContract(label: string, makeTarget: () => ContractTarget): void {
  describe(`${label}：找回密码与注册手机号（v1.3）`, () => {
    it('注册：缺手机号或手机号格式不对 → VALIDATION_ERROR（fields.phone）', async () => {
      const target = makeTarget()
      for (const phone of [undefined, '1380000000', '138000000000', '138 0000 000', '23800000000']) {
        const body = { username: nextUsername(), password: 'Passw0rd!', displayName: '契约用户', phone }
        const error = await expectCode(target.api.register(body as RegisterRequest), 'VALIDATION_ERROR')
        expect(error.details?.fields).toHaveProperty('phone')
      }
    })

    it('不存在的用户名：RESET_INFO_MISMATCH，remainingAttempts 6、5（与真实账号表现一致）', async () => {
      const target = makeTarget()
      const request = { username: nextUsername(), displayName: '契约用户', phone: PHONE, newPassword: 'NewPassw0rd!' }
      const first = await expectCode(target.api.resetPassword(request), 'RESET_INFO_MISMATCH')
      expect(first.details).toEqual({ remainingAttempts: 6 })
      const second = await expectCode(target.api.resetPassword(request), 'RESET_INFO_MISMATCH')
      expect(second.details).toEqual({ remainingAttempts: 5 })
    })

    it('四项都对：成功（204），旧密码不能再登录，新密码可以登录', async () => {
      const target = makeTarget()
      const username = nextUsername()
      await target.api.register({ username, password: 'Passw0rd!', displayName: '契约用户', phone: PHONE })
      await expect(target.api.resetPassword({ username, displayName: '契约用户', phone: PHONE, newPassword: 'NewPassw0rd!' }))
        .resolves.toBeUndefined()
      await expectCode(target.api.login({ username, password: 'Passw0rd!' }), 'INVALID_CREDENTIALS')
      expect((await target.api.login({ username, password: 'NewPassw0rd!' })).user.username).toBe(username)
    })
  })
}
