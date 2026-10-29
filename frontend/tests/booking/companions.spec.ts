// P2-2c 确认步骤的同行人名单（裁决第 1 节、第 5 节第 1、3、4 条）：查找的各种结果、去空白与空白不请求、
// 添加 / 移除 / 重复 / 满 6、提交时 companionUserIds 的顺序与“无同行人不发字段”、失败时名单保留、成功与“继续订场”后清空。
import { describe, expect, it } from 'vitest'

import type { ApiClient } from '../../src/api/client'
import { ApiError } from '../../src/api/errors'
import type { CreateReservationRequest } from '../../src/api/requests'
import { createBookingBoard } from '../../src/composables/bookingBoard'
import { COMPANION_TEXTS } from '../../src/utils/companionDisplay'
import { enterTennis, FREE_SLOT, openBooking, TODAY, TOMORROW, type BookingContext } from './harness'

// 种子之外再注册几个普通用户（公开接口），凑够 6 位同行人。
async function registerFriends(ctx: BookingContext, names: readonly string[]): Promise<void> {
  for (const [index, displayName] of names.entries()) {
    await ctx.h.api.register({ username: `friend${index + 1}`, password: 'Passw0rd!', displayName, phone: `1390000000${index + 1}` })
  }
}

async function add(ctx: BookingContext, q: string): Promise<boolean> {
  ctx.board.companions.query.value = q
  return ctx.board.companions.lookup()
}

function names(ctx: BookingContext): string[] {
  return ctx.board.companions.list.value.map((companion) => companion.displayName)
}

// 记录 lookupUser 与 createReservation 的调用。
function recording(lookups: string[], creates: CreateReservationRequest[]) {
  return (base: ApiClient): ApiClient => ({
    ...base,
    lookupUser: (q) => { lookups.push(q); return base.lookupUser(q) },
    createReservation: (request) => { creates.push(request); return base.createReservation(request) },
  })
}

async function confirmStep(ctx: BookingContext): Promise<void> {
  await enterTennis(ctx.board)
  ctx.board.selectSlot(4, FREE_SLOT)
  expect(ctx.board.step.value).toBe('confirm')
}

describe('查找同行人', () => {
  it('找到：以 Companion 加入名单并清空输入框；发送前去掉首尾空白', async () => {
    const lookups: string[] = []
    const ctx = await openBooking('zhangsan', recording(lookups, []))
    await expect(add(ctx, '  lisi  ')).resolves.toBe(true)
    expect(lookups).toEqual(['lisi'])
    expect(ctx.board.companions.list.value).toEqual([{ userId: 2, displayName: '李四' }])
    expect(ctx.board.companions.query.value).toBe('')
    expect(ctx.board.companions.notice.value).toBeNull()
  })

  it('空白不发请求', async () => {
    const lookups: string[] = []
    const ctx = await openBooking('zhangsan', recording(lookups, []))
    await expect(add(ctx, '   ')).resolves.toBe(false)
    await expect(add(ctx, '')).resolves.toBe(false)
    expect(lookups).toEqual([])
    expect(ctx.board.companions.notice.value).toBeNull()
  })

  it('NOT_FOUND → “未找到该用户”，输入框保留；改动输入后提示消失', async () => {
    const ctx = await openBooking()
    await expect(add(ctx, 'nobody')).resolves.toBe(false)
    expect(ctx.board.companions.notice.value).toBe(COMPANION_TEXTS.notFound)
    expect(ctx.board.companions.query.value).toBe('nobody')
    ctx.board.companions.query.value = 'nobody2'
    expect(ctx.board.companions.notice.value).toBeNull()
  })

  it('VALIDATION_ERROR 等其他错误码：显示错误码文案', async () => {
    const ctx = await openBooking('zhangsan', (base) => ({
      ...base, lookupUser: () => Promise.reject(new ApiError(400, 'VALIDATION_ERROR', 'x', { fields: { q: '长度不能超过 32' } })),
    }))
    await add(ctx, 'lisi')
    expect(ctx.board.companions.notice.value).toBe('请求参数不合法')
    expect(ctx.board.companions.list.value).toEqual([])
  })

})

describe('查找同行人：本人、重复、进行中', () => {
  it('本人的用户名或手机号：提示“不能添加自己”，不发请求', async () => {
    const lookups: string[] = []
    const ctx = await openBooking('zhangsan')
    const board = createBookingBoard({
      api: recording(lookups, [])(ctx.h.api), call: ctx.call, reference: ctx.reference, today: () => TODAY,
      self: () => ({ username: 'zhangsan', phone: '13800000000' }),
    })
    for (const q of ['zhangsan', ' 13800000000 ']) {
      board.companions.query.value = q
      await expect(board.companions.lookup()).resolves.toBe(false)
      expect(board.companions.notice.value).toBe(COMPANION_TEXTS.self)
    }
    expect(lookups).toEqual([])
  })

  it('重复添加同一人：提示“已添加过该好友”，名单不变', async () => {
    const ctx = await openBooking()
    await add(ctx, 'lisi')
    await expect(add(ctx, 'lisi')).resolves.toBe(false)
    expect(ctx.board.companions.notice.value).toBe(COMPANION_TEXTS.duplicate)
    expect(names(ctx)).toEqual(['李四'])
  })

  it('查找进行中再次触发：只发一次请求', async () => {
    const lookups: string[] = []
    const ctx = await openBooking('zhangsan', recording(lookups, []))
    ctx.board.companions.query.value = 'lisi'
    const first = ctx.board.companions.lookup()
    expect(ctx.board.companions.looking.value).toBe(true)
    await expect(ctx.board.companions.lookup()).resolves.toBe(false)
    await first
    expect(lookups).toEqual(['lisi'])
    expect(ctx.board.companions.looking.value).toBe(false)
  })

})

describe('名单：添加、移除、满 6', () => {
  it('添加与移除：移除后其余保持顺序，可以再加回来', async () => {
    const ctx = await openBooking()
    await add(ctx, 'lisi')
    await add(ctx, 'wangwu')
    await add(ctx, 'zhaoliu')
    ctx.board.companions.remove(3)
    expect(names(ctx)).toEqual(['李四', '赵六'])
    await add(ctx, 'wangwu')
    expect(names(ctx)).toEqual(['李四', '赵六', '王五'])
  })

  it('满 6 位：full 为真，再查找不发请求', async () => {
    const lookups: string[] = []
    const ctx = await openBooking('zhangsan', recording(lookups, []))
    await registerFriends(ctx, ['周八', '吴九', '郑十', '冯十一'])
    for (const q of ['lisi', 'wangwu', 'zhaoliu', 'friend1', 'friend2', 'friend3']) {
      await add(ctx, q)
    }
    expect(ctx.board.companions.list.value).toHaveLength(6)
    expect(ctx.board.companions.full.value).toBe(true)
    await expect(add(ctx, 'friend4')).resolves.toBe(false)
    expect(lookups).toHaveLength(6)
  })
})

describe('提交', () => {
  it('companionUserIds 按添加顺序发送；成功页给出同行人姓名；成功后名单清空', async () => {
    const creates: CreateReservationRequest[] = []
    const ctx = await openBooking('zhangsan', recording([], creates))
    await confirmStep(ctx)
    await add(ctx, 'zhaoliu')
    await add(ctx, 'lisi')
    await ctx.board.submit()

    expect(creates).toEqual([{ resourceId: 4, serviceDate: TOMORROW, startTime: FREE_SLOT, companionUserIds: [4, 2] }])
    expect(ctx.board.step.value).toBe('done')
    expect(ctx.board.resultCompanions.value).toBe('赵六、李四')
    expect(ctx.board.companions.list.value).toEqual([])
  })

  it('没有同行人：请求里不带 companionUserIds，成功页不显示同行', async () => {
    const creates: CreateReservationRequest[] = []
    const ctx = await openBooking('zhangsan', recording([], creates))
    await confirmStep(ctx)
    await ctx.board.submit()
    expect(creates[0]).not.toHaveProperty('companionUserIds')
    expect(ctx.board.resultCompanions.value).toBeNull()
  })

})

describe('提交失败：名单保留', () => {
  it('同行人校验失败（fields.companionUserIds）：确认层显示专门文案，名单保留，仍在确认步骤', async () => {
    const ctx = await openBooking()
    await confirmStep(ctx)
    await add(ctx, 'lisi')
    await add(ctx, 'wangwu')
    await ctx.h.disableAccount('wangwu')
    await ctx.board.submit()

    expect(ctx.board.step.value).toBe('confirm')
    expect(ctx.board.submitError.value).toBe(COMPANION_TEXTS.submitInvalid)
    expect(names(ctx)).toEqual(['李四', '王五'])
  })

  it('其他字段的 VALIDATION_ERROR 仍显示错误码文案', async () => {
    const ctx = await openBooking('zhangsan', (base) => ({
      ...base, createReservation: () => Promise.reject(new ApiError(400, 'VALIDATION_ERROR', 'x', { fields: { purpose: '长度不能超过 200' } })),
    }))
    await confirmStep(ctx)
    await add(ctx, 'lisi')
    await ctx.board.submit()
    expect(ctx.board.submitError.value).toBe('请求参数不合法')
    expect(names(ctx)).toEqual(['李四'])
  })

  it('SLOT_TAKEN：回到时段层，名单保留；重选时段后仍在', async () => {
    const ctx = await openBooking()
    await confirmStep(ctx)
    await add(ctx, 'lisi')
    const lisi = await ctx.other('lisi')
    await lisi.createReservation({ resourceId: 4, serviceDate: TOMORROW, startTime: FREE_SLOT })
    await ctx.board.submit()

    expect(ctx.board.step.value).toBe('slots')
    expect(names(ctx)).toEqual(['李四'])
    ctx.board.selectSlot(4, '12:30')
    expect(ctx.board.step.value).toBe('confirm')
    expect(names(ctx)).toEqual(['李四'])
  })

})

describe('名单保留到离开订场页', () => {
  it('返回时段层、换日期、换场馆：名单保留', async () => {
    const ctx = await openBooking()
    await confirmStep(ctx)
    await add(ctx, 'lisi')
    ctx.board.backToSlots()
    ctx.board.backToDates()
    ctx.board.backToVenues()
    expect(names(ctx)).toEqual(['李四'])
  })

})

describe('清空名单的时机', () => {
  it('“继续订场”：名单与输入框清空', async () => {
    const ctx = await openBooking()
    await confirmStep(ctx)
    await add(ctx, 'lisi')
    await ctx.board.submit()
    ctx.board.companions.query.value = 'wang'
    await ctx.board.restart()
    expect(ctx.board.companions.list.value).toEqual([])
    expect(ctx.board.companions.query.value).toBe('')
  })
})

describe('session.callApi 的 fieldKeys（P2-2c 裁决第 5 节第 4 条）', () => {
  it('VALIDATION_ERROR 带 details.fields 时只给出字段名；其他错误没有 fieldKeys', async () => {
    const ctx = await openBooking()
    const invalid = await ctx.call(() => ctx.h.api.createReservation({
      resourceId: 4, serviceDate: TOMORROW, startTime: FREE_SLOT, companionUserIds: [2, 2],
    }))
    expect(invalid).toMatchObject({ ok: false, code: 'VALIDATION_ERROR', fieldKeys: ['companionUserIds'] })
    const missing = await ctx.call(() => ctx.h.api.lookupUser('nobody'))
    expect(missing.ok).toBe(false)
    expect(missing).not.toHaveProperty('fieldKeys')
  })
})
