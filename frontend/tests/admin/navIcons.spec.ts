// UI-2b-rulings 已定事项第 2 条：两类管理端侧栏每一项都有同一套内联图标；同名导航项在两端用同一个图标。
import { describe, expect, it } from 'vitest'

import { SYS_ADMIN_NAV } from '../../src/router/sysAdminNav'
import { VENUE_ADMIN_NAV } from '../../src/router/venueAdminNav'
import { ICONS } from '../../src/utils/icons'

const ALL = [...VENUE_ADMIN_NAV, ...SYS_ADMIN_NAV]

describe('导航图标数据', () => {
  it('场馆管理员端 7 项、系统管理员端 11 项都声明了图标，且图标都存在', () => {
    expect(VENUE_ADMIN_NAV).toHaveLength(7)
    expect(SYS_ADMIN_NAV).toHaveLength(11)
    for (const entry of ALL) {
      expect(Object.keys(ICONS), entry.label).toContain(entry.icon)
    }
  })

  it('场馆管理员端七项的图标互不相同，系统管理员端十一项的图标互不相同', () => {
    expect(new Set(VENUE_ADMIN_NAV.map((entry) => entry.icon)).size).toBe(7)
    expect(new Set(SYS_ADMIN_NAV.map((entry) => entry.icon)).size).toBe(11)
  })

  it('同名导航项在两端用同一个图标；“场馆公告”与场馆管理员端的“公告”同一个图标', () => {
    const venue = new Map(VENUE_ADMIN_NAV.map((entry) => [entry.label, entry.icon]))
    for (const entry of SYS_ADMIN_NAV) {
      const same = venue.get(entry.label === '场馆公告' ? '公告' : entry.label)
      if (same !== undefined) {
        expect(entry.icon, entry.label).toBe(same)
      }
    }
  })

  it('每个图标都是 24×24 视框内的描边路径（只有路径命令与数字）', () => {
    for (const [name, path] of Object.entries(ICONS)) {
      expect(path, name).toMatch(/^[MmLlHhVvCcSsQqTtAaZz0-9.,\s-]+$/)
    }
  })
})
