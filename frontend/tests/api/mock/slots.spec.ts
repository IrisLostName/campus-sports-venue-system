// 时段派生与时段状态（docs/03 第 3、3.1 节；docs/12 第 5.2 节；规划裁决 A6、A7）。
import { describe, expect, it } from 'vitest'

import { createHarness, expectApiError, setTime, TODAY, TOMORROW } from '../support/harness'

const TENNIS_STARTS = ['08:00', '09:30', '11:00', '12:30', '14:00', '15:30', '17:00', '18:30']
const POOL_STARTS = ['09:00', '10:30', '12:00', '13:30', '15:00', '16:30', '18:00', '19:30']

async function tennisSlots(h: ReturnType<typeof createHarness>, date: string) {
  return h.api.getVenueSlots(1, date)
}

describe('时段派生（03 第 3 节）', () => {
  it('网球馆 08:00–20:00 按 90 分钟切成 8 段，最后一段 18:30–20:00', async () => {
    const h = createHarness()
    await h.loginAs('lisi')
    const slots = await tennisSlots(h, TODAY)
    expect(slots.resources).toHaveLength(4)
    for (const resource of slots.resources) {
      expect(resource.slots.map((s) => s.startTime)).toEqual(TENNIS_STARTS)
    }
    expect(slots.resources[0]?.slots[7]).toMatchObject({ startTime: '18:30', endTime: '20:00' })
  })

  it('每段长度恰为 90 分钟且首尾相接', async () => {
    const h = createHarness()
    await h.loginAs('lisi')
    const first = (await tennisSlots(h, TODAY)).resources[0]?.slots ?? []
    first.forEach((slot, index) => {
      const next = first[index + 1]
      if (next !== undefined) {
        expect(slot.endTime).toBe(next.startTime)
      }
    })
    expect(first.map((s) => s.endTime)).toEqual([...TENNIS_STARTS.slice(1), '20:00'])
  })

  it('游泳馆 09:00–21:00 的窗口在管理端占用总览中同样切成 8 段', async () => {
    const h = createHarness()
    await h.loginAs('sysadmin')
    const occupancy = await h.api.adminGetOccupancy(3, TODAY)
    expect(occupancy.resources).toHaveLength(6)
    expect(occupancy.resources[0]?.slots.map((s) => s.startTime)).toEqual(POOL_STARTS)
  })

  it('同一星期可有多个窗口，各自独立切分；其他星期不受影响', async () => {
    const h = createHarness()
    await h.loginAs('sysadmin')
    await h.api.adminReplaceWeeklyRules(1, {
      windows: [
        { weekday: 1, openTime: '08:00', closeTime: '11:00' },
        { weekday: 1, openTime: '14:00', closeTime: '17:00' },
        { weekday: 2, openTime: '08:00', closeTime: '20:00' },
      ],
    })
    await h.loginAs('lisi')
    const monday = (await tennisSlots(h, TODAY)).resources[0]?.slots.map((s) => s.startTime)
    expect(monday).toEqual(['08:00', '09:30', '14:00', '15:30'])
    const tuesday = (await tennisSlots(h, TOMORROW)).resources[0]?.slots.map((s) => s.startTime)
    expect(tuesday).toEqual(TENNIS_STARTS)
  })

  it('星期取自日期：周一=1 … 周日=7，没有窗口的星期没有时段', async () => {
    const h = createHarness()
    await h.loginAs('sysadmin')
    await h.api.adminReplaceWeeklyRules(1, {
      windows: [{ weekday: 2, openTime: '08:00', closeTime: '09:30' }],
      onExistingReservations: 'KEEP',
    })
    await h.loginAs('lisi')
    expect((await tennisSlots(h, TODAY)).resources[0]?.slots).toEqual([])
    expect((await tennisSlots(h, TOMORROW)).resources[0]?.slots).toHaveLength(1)
  })
})

describe('扣除关闭规则、维护与停用（03 第 3 节第 4、5 步）', () => {
  it('整馆关闭：关闭日期内全部时段为 CLOSED，日期范围含两端', async () => {
    const h = createHarness()
    await h.loginAs('sysadmin')
    await h.api.adminAddClosure(1, { startDate: TOMORROW, endDate: '2026-10-14', onExistingReservations: 'KEEP' })
    await h.loginAs('lisi')
    const statuses = async (date: string) =>
      new Set((await tennisSlots(h, date)).resources.flatMap((r) => r.slots.map((s) => s.status)))
    expect(await statuses(TODAY)).toEqual(new Set(['AVAILABLE']))
    expect(await statuses(TOMORROW)).toEqual(new Set(['CLOSED', 'BOOKED', 'MINE']))
    expect(await statuses('2026-10-14')).toEqual(new Set(['CLOSED']))
    expect(await statuses('2026-10-15')).toEqual(new Set(['AVAILABLE']))
  })

  it('单场地关闭只影响该场地', async () => {
    const h = createHarness()
    await h.loginAs('sysadmin')
    await h.api.adminAddClosure(1, { startDate: TODAY, endDate: TODAY, resourceId: 3 })
    await h.loginAs('lisi')
    const resources = (await tennisSlots(h, TODAY)).resources
    const closed = resources.filter((r) => r.slots.every((s) => s.status === 'CLOSED')).map((r) => r.resourceId)
    expect(closed).toEqual([3])
  })

  it('MAINTENANCE 的场地出现但时段为 CLOSED；DISABLED 的场地不出现', async () => {
    const h = createHarness()
    await h.loginAs('sysadmin')
    await h.api.adminUpdateResource(2, { operationalStatus: 'MAINTENANCE', onExistingReservations: 'KEEP' })
    await h.api.adminUpdateResource(4, { operationalStatus: 'DISABLED' })
    await h.loginAs('lisi')
    const resources = (await tennisSlots(h, TODAY)).resources
    expect(resources.map((r) => r.resourceId)).toEqual([1, 2, 3])
    expect(resources[1]?.operationalStatus).toBe('MAINTENANCE')
    expect(resources[1]?.slots.every((s) => s.status === 'CLOSED')).toBe(true)
  })

  it('场馆 CLOSED 后不再可预约：VENUE_NOT_BOOKABLE', async () => {
    const h = createHarness()
    await h.loginAs('sysadmin')
    await h.api.adminUpdateVenue(1, { operationalStatus: 'CLOSED', onExistingReservations: 'KEEP' })
    await expectApiError(h.api.getVenueSlots(1, TODAY), 'VENUE_NOT_BOOKABLE')
  })
})

describe('时段状态与优先级（03 第 3.1 节；规划裁决 A7）', () => {
  it('BOOKED / MINE 由 Token 决定：zhangsan 看到自己的 MINE，lisi 看到 BOOKED', async () => {
    const h = createHarness()
    await h.loginAs('zhangsan')
    expect((await tennisSlots(h, TOMORROW)).resources[0]?.slots[0]?.status).toBe('MINE')
    await h.loginAs('lisi')
    expect((await tennisSlots(h, TOMORROW)).resources[0]?.slots[0]?.status).toBe('BOOKED')
  })

  it('开始时间已过的时段为 PAST，恰好等于当前时刻也是 PAST', async () => {
    const h = createHarness()
    setTime(h, TODAY, '09:30')
    await h.loginAs('lisi')
    const slots = (await tennisSlots(h, TODAY)).resources[0]?.slots.map((s) => s.status)
    expect(slots?.slice(0, 3)).toEqual(['PAST', 'PAST', 'AVAILABLE'])
  })

  it('PAST 优先于 MINE：已过去的自己的预约显示 PAST', async () => {
    const h = createHarness()
    setTime(h, TOMORROW, '08:30')
    await h.loginAs('zhangsan')
    expect((await tennisSlots(h, TOMORROW)).resources[0]?.slots[0]?.status).toBe('PAST')
  })

  it('取消预约后时段重新变为 AVAILABLE', async () => {
    const h = createHarness()
    await h.loginAs('zhangsan')
    const [mine] = (await h.api.listMyReservations()).items
    await h.api.cancelReservation(mine?.id ?? 0)
    expect((await tennisSlots(h, TOMORROW)).resources[0]?.slots[0]?.status).toBe('AVAILABLE')
  })
})

describe('日期范围与访问控制（规划裁决 A6）', () => {
  it('范围是 [今天, 今天+7)：今天与第 6 天可查，第 7 天与昨天 DATE_OUT_OF_RANGE', async () => {
    const h = createHarness()
    await h.loginAs('lisi')
    await expect(tennisSlots(h, TODAY)).resolves.toBeDefined()
    await expect(tennisSlots(h, '2026-10-18')).resolves.toBeDefined()
    await expectApiError(tennisSlots(h, '2026-10-19'), 'DATE_OUT_OF_RANGE', { advanceDays: 7 })
    await expectApiError(tennisSlots(h, '2026-10-11'), 'DATE_OUT_OF_RANGE')
  })

  it('暂未开放预约的场馆：VENUE_NOT_BOOKABLE', async () => {
    const h = createHarness()
    await h.loginAs('lisi')
    await expectApiError(h.api.getVenueSlots(2, TODAY), 'VENUE_NOT_BOOKABLE')
    await expectApiError(h.api.getVenueSlots(3, TODAY), 'VENUE_NOT_BOOKABLE')
  })

  it('不存在的场馆 NOT_FOUND；日期格式错误 VALIDATION_ERROR；未登录 AUTH_REQUIRED', async () => {
    const h = createHarness()
    await expectApiError(h.api.getVenueSlots(1, TODAY), 'AUTH_REQUIRED')
    await h.loginAs('lisi')
    await expectApiError(h.api.getVenueSlots(99, TODAY), 'NOT_FOUND')
    await expectApiError(h.api.getVenueSlots(1, '2026-13-40'), 'VALIDATION_ERROR')
  })
})
