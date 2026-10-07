// 签到与签退窗口边界（docs/10 第 4 节；规划裁决 A5）。种子预约 1：zhangsan，明天 08:00–09:30。
// 签到窗口是闭区间 [07:45:00, 08:15:00]；签退要求当前时间 < 结束 + 30 分钟（10:00:00，严格小于）。
import { describe, expect, it } from 'vitest'

import { createHarness, expectApiError, travel, TOMORROW } from '../support/harness'

const ID = 1
const at = (time: string) => `${TOMORROW}T${time}`

async function atTime(time: string, username = 'zhangsan') {
  const h = createHarness()
  await travel(h, at(time), username)
  return h
}

describe('签到窗口边界', () => {
  it.each([['07:45:00'], ['07:45:01'], ['08:00:00'], ['08:14:59'], ['08:15:00']])('%s 可以签到', async (time) => {
    const h = await atTime(time)
    const result = await h.api.checkIn(ID)
    expect(result).toMatchObject({ checkInAt: at(time), displayStatus: 'IN_USE', status: 'CONFIRMED' })
  })

  it.each([['07:44:59'], ['07:44:00'], ['06:00:00']])('%s 窗口未开 → CHECKIN_WINDOW_CLOSED，details 含 opensAt/closesAt', async (time) => {
    const h = await atTime(time)
    await expectApiError(h.api.checkIn(ID), 'CHECKIN_WINDOW_CLOSED', {
      opensAt: at('07:45:00'), closesAt: at('08:15:00'),
    })
  })

  it('08:15:01 起已越过判定点：预约成为 NO_SHOW，签到 → INVALID_STATE', async () => {
    const h = await atTime('08:15:01')
    await expectApiError(h.api.checkIn(ID), 'INVALID_STATE', { status: 'NO_SHOW' })
  })
})

describe('签到的错误码与顺序', () => {
  it('窗口内重复签到 → ALREADY_CHECKED_IN', async () => {
    const h = await atTime('08:00:00')
    await h.api.checkIn(ID)
    await expectApiError(h.api.checkIn(ID), 'ALREADY_CHECKED_IN')
  })

  it('窗口外已签到者再签到 → CHECKIN_WINDOW_CLOSED（先于 ALREADY_CHECKED_IN）', async () => {
    const h = await atTime('08:00:00')
    await h.api.checkIn(ID)
    h.clock.set(at('08:20:00'))
    await expectApiError(h.api.checkIn(ID), 'CHECKIN_WINDOW_CLOSED')
  })

  it('他人的预约 → NOT_OWNER；不存在 → NOT_FOUND', async () => {
    const h = await atTime('08:00:00', 'lisi')
    await expectApiError(h.api.checkIn(ID), 'NOT_OWNER')
    await expectApiError(h.api.checkIn(999), 'NOT_FOUND')
  })

  it('已取消 → INVALID_STATE（先于窗口检查）', async () => {
    const h = await atTime('05:00:00')
    await h.api.cancelReservation(ID)
    await expectApiError(h.api.checkIn(ID), 'INVALID_STATE', { status: 'CANCELLED' })
  })
})

describe('签退边界：当前时间 < 结束 + 30 分钟', () => {
  async function checkedInAt8() {
    const h = await atTime('08:00:00')
    await h.api.checkIn(ID)
    return h
  }

  it.each([['08:30:00'], ['09:29:59'], ['09:30:00'], ['09:59:59']])('%s 可以签退', async (time) => {
    const h = await checkedInAt8()
    h.clock.set(at(time))
    expect(await h.api.checkOut(ID)).toMatchObject({ checkOutAt: at(time) })
  })

  it('10:00:00（结束后恰好 30 分钟）→ INVALID_STATE', async () => {
    const h = await checkedInAt8()
    h.clock.set(at('10:00:00'))
    await expectApiError(h.api.checkOut(ID), 'INVALID_STATE', { status: 'COMPLETED' })
  })

  it('预约已 COMPLETED（过了结束时刻）仍可在宽限内签退', async () => {
    const h = await checkedInAt8()
    h.clock.set(at('09:40:00'))
    expect((await h.api.getReservation(ID)).status).toBe('COMPLETED')
    expect(await h.api.checkOut(ID)).toMatchObject({ status: 'COMPLETED', checkOutAt: at('09:40:00') })
  })
})

describe('签退的错误码与顺序', () => {
  it('未签到 → NOT_CHECKED_IN', async () => {
    const h = await atTime('08:00:00')
    await expectApiError(h.api.checkOut(ID), 'NOT_CHECKED_IN')
  })

  it('已签退再签退 → ALREADY_CHECKED_OUT', async () => {
    const h = await atTime('08:00:00')
    await h.api.checkIn(ID)
    await h.api.checkOut(ID)
    await expectApiError(h.api.checkOut(ID), 'ALREADY_CHECKED_OUT')
  })

  it('他人的预约 → NOT_OWNER（先于未签到）', async () => {
    const h = await atTime('08:00:00', 'lisi')
    await expectApiError(h.api.checkOut(ID), 'NOT_OWNER')
  })

  it('已取消 → INVALID_STATE（先于 NOT_CHECKED_IN）', async () => {
    const h = await atTime('05:00:00')
    await h.api.cancelReservation(ID)
    await expectApiError(h.api.checkOut(ID), 'INVALID_STATE', { status: 'CANCELLED' })
  })

  it('NO_SHOW 的预约 → INVALID_STATE', async () => {
    const h = await atTime('08:16:00')
    await expectApiError(h.api.checkOut(ID), 'INVALID_STATE', { status: 'NO_SHOW' })
  })
})
