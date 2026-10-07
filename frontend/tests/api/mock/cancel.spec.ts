// 用户取消：本人 → CONFIRMED → 无签到记录 → 距开始 ≥ cancelDeadlineMinutes（docs/10 第 3 节；docs/03 第 4.3 节）。
// 种子预约 1：zhangsan，明天 08:00–09:30，网球场1。取消期限 120 分钟，即 06:00:00 之前（含）可取消。
import { describe, expect, it } from 'vitest'

import { createHarness, expectApiError, travel, TOMORROW } from '../support/harness'

const RESERVATION_ID = 1

async function cancelAt(timestamp: string, reason?: string) {
  const h = createHarness()
  await travel(h, timestamp, 'zhangsan')
  return { h, result: h.api.cancelReservation(RESERVATION_ID, reason === undefined ? undefined : { reason }) }
}

describe('取消期限边界（距开始 ≥ 120 分钟，含 120）', () => {
  it.each([
    ['提前 120 分钟 01 秒', `${TOMORROW}T05:59:59`],
    ['恰好提前 120 分钟', `${TOMORROW}T06:00:00`],
  ])('%s：可以取消', async (_label, timestamp) => {
    const { result } = await cancelAt(timestamp)
    await expect(result).resolves.toMatchObject({ status: 'CANCELLED' })
  })

  it.each([
    ['提前 119 分钟 59 秒', `${TOMORROW}T06:00:01`],
    ['提前 60 分钟', `${TOMORROW}T07:00:00`],
    ['开始后 1 分钟', `${TOMORROW}T08:01:00`],
  ])('%s：CANCEL_DEADLINE_PASSED', async (_label, timestamp) => {
    const { result } = await cancelAt(timestamp)
    await expectApiError(result, 'CANCEL_DEADLINE_PASSED', { cancelDeadlineMinutes: 120 })
  })
})

describe('取消成功', () => {
  it('置 CANCELLED，记录 cancelledAt、cancelledBy、cancelReason，displayStatus 同为 CANCELLED', async () => {
    const { result } = await cancelAt(`${TOMORROW}T05:00:00`, '临时有事')
    expect(await result).toMatchObject({
      status: 'CANCELLED', displayStatus: 'CANCELLED', cancelledAt: `${TOMORROW}T05:00:00`,
      cancelledBy: 1, cancelReason: '临时有事', adminNote: null,
    })
  })

  it('原因可省略', async () => {
    const { result } = await cancelAt(`${TOMORROW}T05:00:00`)
    expect(await result).toMatchObject({ status: 'CANCELLED', cancelReason: null })
  })

  it('取消后出现在“历史”而不在“当前”', async () => {
    const { h, result } = await cancelAt(`${TOMORROW}T05:00:00`)
    await result
    expect((await h.api.listMyReservations({ scope: 'CURRENT' })).items).toEqual([])
    expect((await h.api.listMyReservations({ scope: 'HISTORY' })).items.map((r) => r.status)).toEqual(['CANCELLED'])
  })
})

describe('取消失败的错误码与顺序', () => {
  it('他人的预约 → NOT_OWNER', async () => {
    const h = createHarness()
    await h.loginAs('lisi')
    await expectApiError(h.api.cancelReservation(RESERVATION_ID), 'NOT_OWNER')
  })

  it('预约不存在 → NOT_FOUND', async () => {
    const h = createHarness()
    await h.loginAs('zhangsan')
    await expectApiError(h.api.cancelReservation(999), 'NOT_FOUND')
  })

  it('已取消的预约再取消 → INVALID_STATE，details.status', async () => {
    const h = createHarness()
    await h.loginAs('zhangsan')
    await h.api.cancelReservation(RESERVATION_ID)
    await expectApiError(h.api.cancelReservation(RESERVATION_ID), 'INVALID_STATE', { status: 'CANCELLED' })
  })

  it('已签到 → ALREADY_CHECKED_IN（先于取消期限）', async () => {
    const h = createHarness()
    await travel(h, `${TOMORROW}T07:50:00`, 'zhangsan')
    await h.api.checkIn(RESERVATION_ID)
    await expectApiError(h.api.cancelReservation(RESERVATION_ID), 'ALREADY_CHECKED_IN')
  })

  it('NOT_OWNER 先于 INVALID_STATE：他人面对已取消的预约仍是 NOT_OWNER', async () => {
    const h = createHarness()
    await h.loginAs('zhangsan')
    await h.api.cancelReservation(RESERVATION_ID)
    await h.loginAs('lisi')
    await expectApiError(h.api.cancelReservation(RESERVATION_ID), 'NOT_OWNER')
  })

  it('INVALID_STATE 先于取消期限：已 NO_SHOW 的预约', async () => {
    const h = createHarness()
    await travel(h, `${TOMORROW}T08:15:01`, 'zhangsan')
    await expectApiError(h.api.cancelReservation(RESERVATION_ID), 'INVALID_STATE', { status: 'NO_SHOW' })
  })

  it('管理员账号不能走用户端取消 → FORBIDDEN；未登录 → AUTH_REQUIRED', async () => {
    const h = createHarness()
    await expectApiError(h.api.cancelReservation(RESERVATION_ID), 'AUTH_REQUIRED')
    await h.loginAs('admin_tennis')
    await expectApiError(h.api.cancelReservation(RESERVATION_ID), 'FORBIDDEN')
  })

  it('原因超过 200 字 → VALIDATION_ERROR', async () => {
    const { result } = await cancelAt(`${TOMORROW}T05:00:00`, '长'.repeat(201))
    await expectApiError(result, 'VALIDATION_ERROR')
  })
})
