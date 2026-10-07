// 路由访问规则的纯函数（docs/02 第 3.1 节）：角色入口、路径归属、登录后跳转目标的安全校验。
import { describe, expect, it } from 'vitest'

import { decideNavigation, entryPathOf, roleOwnsPath, resolvePostLoginTarget } from '../../src/router/access'
import { DOCK_ITEMS } from '../../src/router/dock'

describe('用户端 Dock', () => {
  it('固定四项，顺序为 首页、预约、订场、我的', () => {
    expect(DOCK_ITEMS).toEqual([
      { label: '首页', path: '/' },
      { label: '预约', path: '/reservation' },
      { label: '订场', path: '/booking' },
      { label: '我的', path: '/me' },
    ])
  })
})

describe('entryPathOf', () => {
  it('三种角色的入口', () => {
    expect(entryPathOf('USER')).toBe('/')
    expect(entryPathOf('VENUE_ADMIN')).toBe('/venue-admin')
    expect(entryPathOf('SYS_ADMIN')).toBe('/sys-admin')
  })
})

describe('roleOwnsPath', () => {
  it.each([
    ['USER', '/', true],
    ['USER', '/reservation', true],
    ['USER', '/booking', true],
    ['USER', '/me', true],
    ['USER', '/me/', true],
    ['USER', '/reservation/12', true],
    ['USER', '/meeting', false],
    ['USER', '/venue-admin', false],
    ['USER', '/sys-admin/users', false],
    ['USER', '/display', false],
    ['VENUE_ADMIN', '/venue-admin', true],
    ['VENUE_ADMIN', '/venue-admin/reservations', true],
    ['VENUE_ADMIN', '/venue-admin-evil', false],
    ['VENUE_ADMIN', '/', false],
    ['VENUE_ADMIN', '/sys-admin', false],
    ['SYS_ADMIN', '/sys-admin', true],
    ['SYS_ADMIN', '/sys-admin/users', true],
    ['SYS_ADMIN', '/', false],
    ['SYS_ADMIN', '/venue-admin', false],
  ] as const)('%s 访问 %s → %s', (role, path, expected) => {
    expect(roleOwnsPath(role, path)).toBe(expected)
  })
})

describe('resolvePostLoginTarget', () => {
  it.each([
    ['USER', '/booking', '/booking'],
    ['USER', '/booking?date=2026-10-13', '/booking?date=2026-10-13'],
    ['USER', '/me#top', '/me#top'],
    ['VENUE_ADMIN', '/venue-admin/reservations', '/venue-admin/reservations'],
    ['SYS_ADMIN', '/sys-admin', '/sys-admin'],
  ] as const)('%s 的 redirect=%s 属于本角色，采用', (role, redirect, expected) => {
    expect(resolvePostLoginTarget(role, redirect)).toBe(expected)
  })

  it.each([
    ['USER', '/venue-admin', '/'],
    ['USER', '/sys-admin/users', '/'],
    ['VENUE_ADMIN', '/booking', '/venue-admin'],
    ['VENUE_ADMIN', '/sys-admin', '/venue-admin'],
    ['SYS_ADMIN', '/', '/sys-admin'],
    ['SYS_ADMIN', '/me', '/sys-admin'],
    ['USER', '/display', '/'],
    ['USER', '/login', '/'],
  ] as const)('%s 的 redirect=%s 不属于本角色，回到入口 %s', (role, redirect, entry) => {
    expect(resolvePostLoginTarget(role, redirect)).toBe(entry)
  })

  it.each([
    ['缺失', undefined],
    ['空字符串', ''],
    ['数组', ['/booking']],
    ['null', null],
    ['外部地址', 'https://evil.example/booking'],
    ['协议相对地址', '//evil.example'],
    ['反斜杠', '/\\evil.example'],
    ['不以 / 开头', 'booking'],
  ])('redirect 无效（%s）：回到入口', (_label, redirect) => {
    expect(resolvePostLoginTarget('USER', redirect)).toBe('/')
  })
})

describe('decideNavigation', () => {
  const target = (access: 'public' | 'guest' | 'fallback' | 'USER' | 'VENUE_ADMIN' | 'SYS_ADMIN' | undefined, fullPath = '/x') =>
    ({ fullPath, meta: { access } })

  it('public 对任何人放行', () => {
    expect(decideNavigation(target('public'), null)).toBe(true)
    expect(decideNavigation(target('public'), 'USER')).toBe(true)
  })

  it('未登录访问受保护路径 → 登录页并带 redirect', () => {
    expect(decideNavigation(target('USER', '/booking?x=1'), null)).toEqual({
      path: '/login', query: { redirect: '/booking?x=1' },
    })
  })

  it('未登录访问登录页放行；未知路径去登录页且不带 redirect', () => {
    expect(decideNavigation(target('guest', '/login'), null)).toBe(true)
    expect(decideNavigation(target('fallback', '/nope'), null)).toEqual({ path: '/login' })
  })

  it('已登录访问登录页或未知路径 → 本角色入口', () => {
    expect(decideNavigation(target('guest', '/login'), 'SYS_ADMIN')).toBe('/sys-admin')
    expect(decideNavigation(target('fallback', '/nope'), 'VENUE_ADMIN')).toBe('/venue-admin')
  })

  it('角色不符 → 本角色入口；角色相符放行', () => {
    expect(decideNavigation(target('VENUE_ADMIN'), 'USER')).toBe('/')
    expect(decideNavigation(target('VENUE_ADMIN'), 'VENUE_ADMIN')).toBe(true)
  })

  it('没有声明 access 的路由按未知路径处理，不会被默认放行', () => {
    expect(decideNavigation(target(undefined), null)).toEqual({ path: '/login' })
    expect(decideNavigation(target(undefined), 'USER')).toBe('/')
  })
})
