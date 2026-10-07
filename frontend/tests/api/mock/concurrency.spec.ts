// 并发占用：同一场地同一日期同一时段至多一个有效预约（docs/03 第 4.1 节；docs/10 第 1 节；docs/13 第 3.5 节）。
// mock 的“检查 + 写入”在同一同步段内完成，插入层再检查一次唯一性，模拟 uq_reservation_active_slot 部分唯一索引。
import { describe, expect, it } from 'vitest'

import { createMockClient } from '../../../src/api/mock/index'
import { checkCreatable, insertReservation, stepSlotFree } from '../../../src/api/mock/reservationRules'
import { isActiveStatus } from '../../../src/api/mock/slotDerivation'
import { ApiError } from '../../../src/api/errors'
import type { ReservationStatus } from '../../../src/api/types'
import { DEMO_PASSWORD } from '../../../src/api/mock/seed'
import { book, createHarness, expectApiError, TOMORROW, type Harness } from '../support/harness'

const SLOT = { resourceId: 3, serviceDate: TOMORROW, startTime: '11:00' }

function activeAtSlot(h: Harness, resourceId: number, date: string, start: string): number {
  return h.context.state.reservations.filter((r) =>
    r.resourceId === resourceId && r.serviceDate === date && r.startTime === start && isActiveStatus(r.status)).length
}

// 为同一份内存状态创建 count 个相互独立的用户端客户端（各自带自己的 Token）。
async function competingClients(h: Harness, count: number) {
  const tokens: string[] = []
  for (let index = 0; index < count; index += 1) {
    const username = `racer${index}`
    const session = await h.api.register({ username, password: DEMO_PASSWORD, displayName: `选手${index}` })
    tokens.push(session.token)
  }
  return tokens.map((token) => createMockClient({ state: h.context.state, clock: h.clock, getToken: () => token }))
}

describe('并发创建同一时段', () => {
  it('2 个并发请求：恰好 1 个成功，另 1 个 SLOT_TAKEN', async () => {
    const h = createHarness()
    const clients = await competingClients(h, 2)
    const results = await Promise.allSettled(clients.map((c) => book(c, SLOT.resourceId, SLOT.serviceDate, SLOT.startTime)))
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    const rejected = results.filter((r) => r.status === 'rejected')
    expect(rejected.map((r) => (r.reason as ApiError).code)).toEqual(['SLOT_TAKEN'])
  })

  it('10 个并发请求：恰好 1 个成功、9 个 SLOT_TAKEN，库中该时段有效预约恰 1 条', async () => {
    const h = createHarness()
    const clients = await competingClients(h, 10)
    const results = await Promise.allSettled(clients.map((c) => book(c, SLOT.resourceId, SLOT.serviceDate, SLOT.startTime)))
    const codes = results.map((r) => (r.status === 'fulfilled' ? 'OK' : (r.reason as ApiError).code))
    expect(codes.filter((code) => code === 'OK')).toHaveLength(1)
    expect(codes.filter((code) => code === 'SLOT_TAKEN')).toHaveLength(9)
    expect(activeAtSlot(h, SLOT.resourceId, SLOT.serviceDate, SLOT.startTime)).toBe(1)
  })

  it('不同时段互不影响：10 个并发请求各订不同场地，全部成功', async () => {
    const h = createHarness()
    const clients = await competingClients(h, 4)
    const results = await Promise.allSettled(clients.map((c, index) => book(c, index + 1, TOMORROW, '14:00')))
    expect(results.every((r) => r.status === 'fulfilled')).toBe(true)
  })
})

describe('插入层的唯一性检查（绕过第 8 步直接插入）', () => {
  const draft = { userId: 1, ...SLOT, purpose: null }

  it('同一时段已有有效预约时，直接插入返回 SLOT_TAKEN，不产生第二条有效预约', async () => {
    const h = createHarness()
    insertReservation(h.context, draft)
    const before = h.context.state.reservations.length
    expect(() => insertReservation(h.context, { ...draft, userId: 2 })).toThrow(ApiError)
    try {
      insertReservation(h.context, { ...draft, userId: 2 })
    } catch (error) {
      expect(error).toMatchObject({ code: 'SLOT_TAKEN', status: 409 })
    }
    expect(h.context.state.reservations).toHaveLength(before)
    expect(activeAtSlot(h, SLOT.resourceId, SLOT.serviceDate, SLOT.startTime)).toBe(1)
  })

  it.each<ReservationStatus>(['CONFIRMED', 'COMPLETED', 'NO_SHOW'])('%s 仍占用该时段', (status) => {
    const h = createHarness()
    const record = insertReservation(h.context, draft)
    record.status = status
    expect(() => insertReservation(h.context, { ...draft, userId: 2 })).toThrow(ApiError)
  })

  it.each<ReservationStatus>(['CANCELLED', 'ADMIN_CANCELLED'])('%s 释放该时段，可再次插入', (status) => {
    const h = createHarness()
    const record = insertReservation(h.context, draft)
    record.status = status
    expect(insertReservation(h.context, { ...draft, userId: 2 }).userId).toBe(2)
    expect(activeAtSlot(h, SLOT.resourceId, SLOT.serviceDate, SLOT.startTime)).toBe(1)
  })
})

// 第 8 步（docs/10 第 1 节）是插入前的前置检查，与插入层的检查在 API 层面等价，必须单独证明它存在：
// 这里不经过 insertReservation，直接调用第 8 步。
describe('第 8 步前置检查（不经过插入层）', () => {
  const SEED_SLOT = { resourceId: 1, serviceDate: TOMORROW, startTime: '08:00' }   // 种子：zhangsan 的预约

  const wangwu = (h: Harness) => {
    const user = h.context.state.users.find((candidate) => candidate.username === 'wangwu')
    if (user === undefined) {
      throw new Error('种子缺少 wangwu')
    }
    return user
  }

  it('stepSlotFree：时段已有有效预约 → SLOT_TAKEN', () => {
    const h = createHarness()
    expect(() => stepSlotFree(h.context, SEED_SLOT.resourceId, SEED_SLOT.serviceDate, SEED_SLOT.startTime)).toThrow(
      expect.objectContaining({ code: 'SLOT_TAKEN', status: 409 }),
    )
  })

  it('stepSlotFree：时段空闲，或原预约已取消 → 不抛错', () => {
    const h = createHarness()
    expect(() => stepSlotFree(h.context, 1, TOMORROW, '11:00')).not.toThrow()
    const seeded = h.context.state.reservations.find((r) => r.resourceId === 1 && r.startTime === '08:00')
    if (seeded === undefined) {
      throw new Error('种子缺少明天 08:00 的预约')
    }
    seeded.status = 'CANCELLED'
    expect(() => stepSlotFree(h.context, SEED_SLOT.resourceId, SEED_SLOT.serviceDate, SEED_SLOT.startTime)).not.toThrow()
  })

  it('checkCreatable：第 2–7 步均通过、时段已被占用 → SLOT_TAKEN（未调用 insertReservation）', () => {
    const h = createHarness()
    const before = h.context.state.reservations.length
    expect(() => checkCreatable(h.context, wangwu(h), SEED_SLOT)).toThrow(
      expect.objectContaining({ code: 'SLOT_TAKEN', status: 409 }),
    )
    expect(h.context.state.reservations).toHaveLength(before)
  })

  it('checkCreatable：时段空闲时通过（对照：上一条的 SLOT_TAKEN 来自占用而非其他步骤）', () => {
    const h = createHarness()
    expect(() => checkCreatable(h.context, wangwu(h), { ...SEED_SLOT, startTime: '11:00' })).not.toThrow()
  })
})

describe('取消后重新预约', () => {
  it('用户取消后其他人可以预约同一时段；原预约不再占用', async () => {
    const h = createHarness()
    await h.loginAs('zhangsan')
    const [mine] = (await h.api.listMyReservations()).items
    await h.api.cancelReservation(mine?.id ?? 0)
    await h.loginAs('lisi')
    await expect(book(h.api, 1, TOMORROW, '08:00')).resolves.toMatchObject({ status: 'CONFIRMED' })
  })

  it('时段被占用期间，第二个人得到 SLOT_TAKEN', async () => {
    const h = createHarness()
    await h.loginAs('lisi')
    await book(h.api, 4, TOMORROW, '11:00')
    await h.loginAs('wangwu')
    await expectApiError(book(h.api, 4, TOMORROW, '11:00'), 'SLOT_TAKEN')
  })
})
