// FE-5 X1 / X6：页面的接口调用经 callApi——登录失效回到登录页；权限错误显示 messageFor 文案（权限以后端为准）。
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import { ApiError } from '../../../src/api/errors'
import type { ApiClient } from '../../../src/api/client'
import { buttonIn, content, openAdminApp } from './support'

vi.mock('../../../src/api/index', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/api/index')>()
  const { swappedApi } = await import('../apiSwap')
  return { ...actual, api: swappedApi() }
})

function failing(code: string, ...methods: (keyof ApiClient)[]) {
  return (api: ApiClient): ApiClient => {
    const override: Partial<ApiClient> = {}
    for (const method of methods) {
      Object.assign(override, { [method]: () => Promise.reject(new ApiError(code === 'FORBIDDEN_SCOPE' || code === 'FORBIDDEN' ? 403 : 401, code, '服务端文案')) })
    }
    return { ...api, ...override }
  }
}

const PAGES: [string, keyof ApiClient][] = [
  ['/venue-admin', 'adminGetStatsOverview'],
  ['/venue-admin/reservations', 'adminListReservations'],
  ['/venue-admin/resources', 'adminListResources'],
  ['/venue-admin/occupancy', 'adminGetOccupancy'],
  ['/venue-admin/announcements', 'adminListAnnouncements'],
  ['/venue-admin/repairs', 'adminListRepairs'],
  ['/venue-admin/logs', 'adminListLogs'],
]

describe('X1 登录失效', () => {
  it.each(PAGES)('%s 的数据请求返回 TOKEN_EXPIRED：回到登录页并清除登录状态', async (path, method) => {
    const { router, h } = await openAdminApp(path, { wrap: failing('TOKEN_EXPIRED', method) })
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/login')
    expect(h.auth.isAuthenticated).toBe(false)
  })

  it('操作中途登录失效（取消预约）：对话框关闭并回到登录页', async () => {
    const { router, root } = await openAdminApp('/venue-admin/reservations', { wrap: failing('TOKEN_EXPIRED', 'adminCancelReservation') })
    const row = content(root).findAll('tbody tr')[0]
    await buttonIn(row as never, '取消').trigger('click')
    await content(root).get('[role="dialog"] textarea').setValue('原因')
    await buttonIn(content(root).get('[role="dialog"]'), '确认取消').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/login')
  })
})

describe('X6 权限错误显示文案', () => {
  it.each(PAGES)('%s 的数据请求返回 FORBIDDEN_SCOPE：显示“无权操作该场馆”，页面没有数据', async (path, method) => {
    const { root } = await openAdminApp(path, { wrap: failing('FORBIDDEN_SCOPE', method) })

    expect(content(root).get('[role="alert"]').text()).toBe('无权操作该场馆')
  })

  it('FORBIDDEN：显示“无权执行此操作”', async () => {
    const { root } = await openAdminApp('/venue-admin/logs', { wrap: failing('FORBIDDEN', 'adminListLogs') })

    expect(content(root).get('[role="alert"]').text()).toBe('无权执行此操作')
  })
})
