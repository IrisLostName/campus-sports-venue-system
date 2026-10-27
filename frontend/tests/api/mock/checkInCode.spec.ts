// v1.1 签发签到码（docs/12 第 5.3 节 GET /reservations/{id}/check-in-code；P2-1c 裁决第 0 节第 2 条）。
// 与后端 CheckInCodeService 同序：认证 → 角色 USER → NOT_FOUND → NOT_OWNER → 有效状态 CONFIRMED → 尚未签到。
// 不检查签到窗口：窗口开始前即可出示。码为 “<该用户的签到标识>.<预约 id>”，固定不变。
import { describe, expect, it } from 'vitest'

import { checkInByScan, createHarness, expectApiError, travel, TOMORROW } from '../support/harness'

const ID = 1
const at = (time: string) => `${TOMORROW}T${time}`

describe('签发签到码', () => {
  it('本人、CONFIRMED、未签到：码 = 本人签到标识 + 预约 id；窗口开始前（前一天）也可取码', async () => {
    const h = createHarness()
    await h.loginAs('zhangsan')
    const zhangsan = h.context.state.users.find((user) => user.username === 'zhangsan')
    expect(await h.api.getCheckInCode(ID)).toEqual({ code: `${zhangsan?.checkInUuid}.${ID}` })
  })

  it('码固定不变：不同时刻取得同一个码', async () => {
    const h = createHarness()
    await travel(h, at('06:00:00'), 'zhangsan')
    const first = await h.api.getCheckInCode(ID)
    h.clock.set(at('08:00:00'))
    expect(await h.api.getCheckInCode(ID)).toEqual(first)
  })

  it('他人的预约 → NOT_OWNER；不存在 → NOT_FOUND', async () => {
    const h = createHarness()
    await h.loginAs('lisi')
    await expectApiError(h.api.getCheckInCode(ID), 'NOT_OWNER')
    await expectApiError(h.api.getCheckInCode(999), 'NOT_FOUND')
  })

  it('管理员 → FORBIDDEN（角色先于 NOT_FOUND）', async () => {
    const h = createHarness()
    await h.loginAs('sysadmin')
    await expectApiError(h.api.getCheckInCode(999), 'FORBIDDEN')
  })

  it('已取消 → INVALID_STATE；已结束（NO_SHOW）→ INVALID_STATE', async () => {
    const h = createHarness()
    await h.loginAs('zhangsan')
    await h.api.cancelReservation(ID)
    await expectApiError(h.api.getCheckInCode(ID), 'INVALID_STATE', { status: 'CANCELLED' })
    await travel(h, at('09:45:01'), 'lisi')
    await expectApiError(h.api.getCheckInCode(2), 'INVALID_STATE', { status: 'NO_SHOW' })
  })

  it('已签到 → ALREADY_CHECKED_IN；结束后（COMPLETED）→ INVALID_STATE', async () => {
    const h = createHarness()
    await travel(h, at('08:00:00'), 'zhangsan')
    await checkInByScan(h.api, await h.clientFor('sysadmin'), ID)
    await expectApiError(h.api.getCheckInCode(ID), 'ALREADY_CHECKED_IN')
    h.clock.set(at('09:30:00'))
    await expectApiError(h.api.getCheckInCode(ID), 'INVALID_STATE', { status: 'COMPLETED' })
  })

  it('未登录 → AUTH_REQUIRED', async () => {
    await expectApiError(createHarness().api.getCheckInCode(ID), 'AUTH_REQUIRED')
  })
})
