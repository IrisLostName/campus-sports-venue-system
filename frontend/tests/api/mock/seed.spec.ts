// 种子数据逐项对应 docs/13 第 5 节（场馆与场地、每周窗口、演示账号、公告、演示预约）。
import { describe, expect, it } from 'vitest'

import { createHarness, TOMORROW } from '../support/harness'

describe('种子数据：场馆与场地（13 第 5.1 节）', () => {
  it('三个场馆的名称、类型与对用户开放预约开关', async () => {
    const h = createHarness()
    await h.loginAs('zhangsan')
    const venues = await h.api.listVenues()
    expect(venues.map((v) => [v.id, v.name, v.venueType, v.userBookingEnabled, v.bookable]))
      .toEqual([
        [1, '网球馆', 'TENNIS', true, true],
        [2, '羽毛球馆', 'BADMINTON', false, false],
        [3, '游泳馆', 'SWIMMING', false, false],
      ])
    expect(venues.map((v) => v.resourceCount)).toEqual([4, 6, 6])
  })

  it('场地名称与类型：网球场1…4、羽毛球场1…6、泳道1…6', async () => {
    const h = createHarness()
    await h.loginAs('sysadmin')
    const names = async (id: number) => (await h.api.adminListResources(id)).map((r) => [r.name, r.resourceType])
    expect(await names(1)).toEqual([1, 2, 3, 4].map((n) => [`网球场${n}`, 'COURT']))
    expect(await names(2)).toEqual([1, 2, 3, 4, 5, 6].map((n) => [`羽毛球场${n}`, 'COURT']))
    expect(await names(3)).toEqual([1, 2, 3, 4, 5, 6].map((n) => [`泳道${n}`, 'LANE']))
  })
})

describe('种子数据：每周开放窗口（13 第 5.2 节）', () => {
  it.each([[1, '08:00', '20:00'], [2, '08:00', '20:00'], [3, '09:00', '21:00']])(
    '场馆 %i 周一至周日 %s–%s',
    async (venueId, openTime, closeTime) => {
      const h = createHarness()
      await h.loginAs('sysadmin')
      const rules = await h.api.adminGetAvailabilityRules(venueId)
      expect(rules.weekly.map((w) => w.weekday)).toEqual([1, 2, 3, 4, 5, 6, 7])
      expect(rules.weekly.every((w) => w.openTime === openTime && w.closeTime === closeTime)).toBe(true)
      expect(rules.closures).toEqual([])
    },
  )
})

describe('种子数据：演示账号（13 第 5.3 节）', () => {
  it('七个账号的姓名、角色、user_type 与授权场馆', async () => {
    const h = createHarness()
    await h.loginAs('sysadmin')
    const users = (await h.api.adminListUsers()).items
    expect(users.map((u) => [u.username, u.displayName, u.role, u.userType, u.venueIds])).toEqual([
      ['zhangsan', '张三', 'USER', 'STUDENT', null],
      ['lisi', '李四', 'USER', 'STUDENT', null],
      ['wangwu', '王五', 'USER', 'TEACHER', null],
      ['zhaoliu', '赵六', 'USER', 'STUDENT', null],
      ['admin_tennis', '网球馆管理员', 'VENUE_ADMIN', 'OTHER', [1]],
      ['admin_pool', '游泳羽毛球馆管理员', 'VENUE_ADMIN', 'OTHER', [2, 3]],
      ['sysadmin', '系统管理员', 'SYS_ADMIN', 'OTHER', null],
    ])
  })

  it('每个演示账号都能用演示口令登录', async () => {
    const h = createHarness()
    for (const username of ['zhangsan', 'lisi', 'wangwu', 'zhaoliu', 'admin_tennis', 'admin_pool', 'sysadmin']) {
      await h.loginAs(username)
      expect((await h.api.getMe()).username).toBe(username)
    }
  })
})

describe('种子数据：公告与演示预约（13 第 5.4、5.5 节）', () => {
  it('1 条系统公告与 1 条网球馆公告', async () => {
    const h = createHarness()
    await h.loginAs('zhangsan')
    const system = await h.api.listAnnouncements({ scope: 'SYSTEM' })
    const venue = await h.api.listAnnouncements({ scope: 'VENUE', venueId: 1 })
    expect(system.map((a) => a.title)).toEqual(['欢迎使用校园场馆预约系统'])
    expect(venue.map((a) => a.title)).toEqual(['场地保养：每周一 08:00–09:30 视情况关闭 1 片球场'])
    expect(await h.api.listAnnouncements({ scope: 'VENUE', venueId: 2 })).toEqual([])
  })

  it('zhangsan 明天网球场1、lisi 明天网球场2 各一个时段，wangwu 无预约', async () => {
    const h = createHarness()
    const mine = async (username: string) => {
      await h.loginAs(username)
      return (await h.api.listMyReservations()).items.map((r) => [r.resourceName, r.serviceDate, r.status])
    }
    expect(await mine('zhangsan')).toEqual([['网球场1', TOMORROW, 'CONFIRMED']])
    expect(await mine('lisi')).toEqual([['网球场2', TOMORROW, 'CONFIRMED']])
    expect(await mine('wangwu')).toEqual([])
  })

  it('演示预约相对注入的“今天”生成', async () => {
    const h = createHarness('2027-01-31T07:00:00')
    await h.loginAs('zhangsan')
    expect((await h.api.listMyReservations()).items[0]?.serviceDate).toBe('2027-02-01')
  })
})
