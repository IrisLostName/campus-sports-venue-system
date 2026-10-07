// 创建预约的九步校验：每一步至少一个失败用例（docs/10 第 1 节；规划裁决 §7-1、§7-3）。
import { describe, expect, it } from 'vitest'

import type { CreateReservationRequest } from '../../../src/api/requests'
import { book, createHarness, expectApiError, setTime, TODAY, TOMORROW, type Harness } from '../support/harness'

async function asUser(username = 'wangwu'): Promise<Harness> {
  const h = createHarness()
  await h.loginAs(username)
  return h
}

describe('第 1 步：Token、角色 USER、账号 ACTIVE', () => {
  it('没有 Token → AUTH_REQUIRED', async () => {
    const h = createHarness()
    await expectApiError(book(h.api, 1, TODAY, '09:30'), 'AUTH_REQUIRED')
  })

  it('Token 超过 8 小时 → TOKEN_EXPIRED', async () => {
    const h = await asUser()
    h.clock.advanceMinutes(8 * 60)
    await expectApiError(book(h.api, 1, TODAY, '18:30'), 'TOKEN_EXPIRED')
  })

  it('Token 7 小时 59 分内仍有效', async () => {
    const h = await asUser()
    h.clock.advanceMinutes(8 * 60 - 1)
    await expect(h.api.getMe()).resolves.toMatchObject({ username: 'wangwu' })
  })

  it('账号被停用后已有 Token 立即失效 → ACCOUNT_DISABLED', async () => {
    const h = await asUser('zhaoliu')
    const account = h.context.state.users.find((u) => u.username === 'zhaoliu')
    expect(account).toBeDefined()
    if (account !== undefined) {
      account.status = 'DISABLED'
    }
    await expectApiError(book(h.api, 1, TODAY, '09:30'), 'ACCOUNT_DISABLED')
  })

  it('管理员角色不能创建预约 → FORBIDDEN', async () => {
    const h = await asUser('sysadmin')
    await expectApiError(book(h.api, 1, TODAY, '09:30'), 'FORBIDDEN')
    await h.loginAs('admin_tennis')
    await expectApiError(book(h.api, 1, TODAY, '09:30'), 'FORBIDDEN')
  })

  it('格式错误先于角色：管理员提交非法日期 → VALIDATION_ERROR', async () => {
    const h = await asUser('sysadmin')
    const error = await expectApiError(book(h.api, 1, '12-10-2026', '09:30'), 'VALIDATION_ERROR')
    expect(error.details).toHaveProperty('fields.serviceDate')
  })

  it('请求里的 userId 与 endTime 被忽略：预约属于 Token 用户，endTime = 开始 + 90 分钟', async () => {
    const h = await asUser()
    const body = { resourceId: 1, serviceDate: TODAY, startTime: '09:30', userId: 1, endTime: '23:00' }
    const created = await h.api.createReservation(body as CreateReservationRequest)
    expect(created.userDisplayName).toBe('王五')
    expect(created.endTime).toBe('11:00')
  })
})

describe('第 2 步：场地存在且场馆 OPEN、对用户开放', () => {
  it('羽毛球馆暂未开放预约 → VENUE_NOT_BOOKABLE', async () => {
    const h = await asUser()
    await expectApiError(book(h.api, 5, TODAY, '09:30'), 'VENUE_NOT_BOOKABLE')
  })

  it('场地不存在 → VENUE_NOT_BOOKABLE（规划裁决 §7-1）', async () => {
    const h = await asUser()
    await expectApiError(book(h.api, 999, TODAY, '09:30'), 'VENUE_NOT_BOOKABLE')
  })

  it('场馆被设为 CLOSED → VENUE_NOT_BOOKABLE', async () => {
    const h = await asUser()
    h.context.state.venues[0] = { ...h.context.state.venues[0]!, operationalStatus: 'CLOSED' }
    await expectApiError(book(h.api, 1, TODAY, '09:30'), 'VENUE_NOT_BOOKABLE')
  })
})

describe('第 3 步：场地状态为 OPEN', () => {
  it.each(['MAINTENANCE', 'DISABLED'] as const)('场地 %s → RESOURCE_UNAVAILABLE', async (status) => {
    const h = await asUser()
    h.context.state.resources[0]!.operationalStatus = status
    await expectApiError(book(h.api, 1, TODAY, '09:30'), 'RESOURCE_UNAVAILABLE')
  })
})

describe('第 4 步：serviceDate ∈ [今天, 今天 + advanceDays)', () => {
  it('今天与第 6 天可预约', async () => {
    const h = await asUser()
    await expect(book(h.api, 1, TODAY, '09:30')).resolves.toBeDefined()
    await expect(book(h.api, 1, '2026-10-18', '09:30')).resolves.toBeDefined()
  })

  it('第 7 天及更远 → DATE_OUT_OF_RANGE，details.advanceDays', async () => {
    const h = await asUser()
    await expectApiError(book(h.api, 1, '2026-10-19', '09:30'), 'DATE_OUT_OF_RANGE', { advanceDays: 7 })
  })

  it('昨天 → DATE_OUT_OF_RANGE（先于 SLOT_IN_PAST）', async () => {
    const h = await asUser()
    await expectApiError(book(h.api, 1, '2026-10-11', '09:30'), 'DATE_OUT_OF_RANGE')
  })
})

describe('第 5 步：派生出的合法时段且不在关闭规则内', () => {
  it('不是 90 分钟切分点（08:30）→ SLOT_NOT_AVAILABLE', async () => {
    const h = await asUser()
    await expectApiError(book(h.api, 1, TODAY, '08:30'), 'SLOT_NOT_AVAILABLE')
  })

  it('窗口之外（20:00 收馆后、07:00 开馆前）→ SLOT_NOT_AVAILABLE', async () => {
    const h = await asUser()
    await expectApiError(book(h.api, 1, TODAY, '20:00'), 'SLOT_NOT_AVAILABLE')
    await expectApiError(book(h.api, 1, TODAY, '06:30'), 'SLOT_NOT_AVAILABLE')
  })

  it('落在关闭规则内 → SLOT_NOT_AVAILABLE；其他场地不受单场地关闭影响', async () => {
    const h = await asUser()
    h.context.state.closures.push({
      id: 1, venueId: 1, resourceId: 3, startDate: TODAY, endDate: TODAY, reason: null, status: 'ACTIVE',
    })
    await expectApiError(book(h.api, 3, TODAY, '09:30'), 'SLOT_NOT_AVAILABLE')
    await expect(book(h.api, 4, TODAY, '09:30')).resolves.toBeDefined()
  })
})

describe('第 6 步：开始时间晚于当前时刻', () => {
  it('开始时间等于当前时刻 → SLOT_IN_PAST', async () => {
    const h = await asUser()
    setTime(h, TODAY, '09:30')
    await expectApiError(book(h.api, 1, TODAY, '09:30'), 'SLOT_IN_PAST')
  })

  it('开始时间晚一秒即可预约', async () => {
    const h = await asUser()
    h.clock.set(`${TODAY}T09:29:59`)
    await expect(book(h.api, 1, TODAY, '09:30')).resolves.toBeDefined()
  })
})

describe('第 7 步：未超过 maxActiveReservationsPerUser', () => {
  it('同时持有 3 个未结束预约后第 4 个 → BOOKING_LIMIT_REACHED，details.max', async () => {
    const h = await asUser('zhangsan')
    await book(h.api, 2, TOMORROW, '08:00')
    await book(h.api, 3, TOMORROW, '08:00')
    await expectApiError(book(h.api, 4, TOMORROW, '08:00'), 'BOOKING_LIMIT_REACHED', { max: 3 })
  })

  it('取消一个后可以再预约', async () => {
    const h = await asUser('zhangsan')
    const second = await book(h.api, 2, TOMORROW, '08:00')
    await book(h.api, 3, TOMORROW, '08:00')
    await h.api.cancelReservation(second.id)
    await expect(book(h.api, 4, TOMORROW, '08:00')).resolves.toBeDefined()
  })
})

describe('第 8、9 步：时段无有效预约，插入并确认', () => {
  it('同一场地同一时段已被预约 → SLOT_TAKEN', async () => {
    const h = await asUser('lisi')
    await expectApiError(book(h.api, 1, TOMORROW, '08:00'), 'SLOT_TAKEN')
  })

  it('成功：CONFIRMED（无审批）、endTime 由服务端算出、displayStatus 为 UPCOMING', async () => {
    const h = await asUser()
    const created = await h.api.createReservation({ resourceId: 1, serviceDate: TODAY, startTime: '09:30', purpose: '练球' })
    expect(created).toMatchObject({
      status: 'CONFIRMED', displayStatus: 'UPCOMING', startTime: '09:30', endTime: '11:00',
      resourceName: '网球场1', venueName: '网球馆', purpose: '练球', createdAt: `${TODAY}T07:00:00`,
      cancelledAt: null, checkInAt: null, checkOutAt: null,
    })
    expect((await h.api.getReservation(created.id)).id).toBe(created.id)
  })
})

describe('多个步骤同时不满足时，返回最靠前的错误码', () => {
  const CASES: ReadonlyArray<readonly [string, number, string, string, string]> = [
    ['步骤 2 先于 4', 5, '2026-10-30', '09:30', 'VENUE_NOT_BOOKABLE'],
    ['步骤 4 先于 5', 1, '2026-10-30', '08:30', 'DATE_OUT_OF_RANGE'],
    ['步骤 4 先于 6', 1, '2026-10-01', '09:30', 'DATE_OUT_OF_RANGE'],
    ['步骤 5 先于 6', 1, TODAY, '07:15', 'SLOT_NOT_AVAILABLE'],
    ['步骤 8 在 6 之后', 1, TOMORROW, '08:00', 'SLOT_TAKEN'],
  ]

  it.each(CASES)('%s', async (_label, resourceId, date, start, code) => {
    const h = await asUser('lisi')
    await expectApiError(book(h.api, resourceId, date, start), code as 'SLOT_TAKEN')
  })

  it('步骤 6 先于 7：已达上限的用户预约过去的时段 → SLOT_IN_PAST', async () => {
    const h = await asUser('zhangsan')
    await book(h.api, 2, TOMORROW, '08:00')
    await book(h.api, 3, TOMORROW, '08:00')
    setTime(h, TODAY, '12:00')
    await h.loginAs('zhangsan')
    await expectApiError(book(h.api, 4, TODAY, '11:00'), 'SLOT_IN_PAST')
  })

  it('步骤 7 先于 8：已达上限的用户预约已被占用的时段 → BOOKING_LIMIT_REACHED', async () => {
    const h = await asUser('zhangsan')
    await book(h.api, 3, TOMORROW, '08:00')
    await book(h.api, 4, TOMORROW, '08:00')
    await expectApiError(book(h.api, 2, TOMORROW, '09:30'), 'BOOKING_LIMIT_REACHED')
  })
})
