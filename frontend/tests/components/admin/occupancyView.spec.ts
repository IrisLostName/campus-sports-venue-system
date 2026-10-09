// FE-5 P5：占用总览页挂载后的渲染结果（ACC-M2-07 的“场地占用总览”）。
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import { content, openAdminApp } from './support'

vi.mock('../../../src/api/index', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/api/index')>()
  const { swappedApi } = await import('../apiSwap')
  return { ...actual, api: swappedApi() }
})

describe('P5 场地占用总览页', () => {
  it('选日期后显示场地 × 时段网格：状态、预约人与展示状态', async () => {
    const { root } = await openAdminApp('/venue-admin/occupancy')
    const main = content(root)
    expect(main.get('h1').text()).toBe('场地占用总览')
    expect(main.find('table').exists()).toBe(true)

    await main.get('input[type="date"]').setValue('2026-10-13')
    await flushPromises()

    expect(main.get('.hint').text()).toBe('网球馆 · 2026-10-13 · 场地数量 4')
    expect(main.findAll('thead th').slice(0, 3).map((th) => th.text())).toEqual(['场地', '08:00–09:30', '09:30–11:00'])
    expect(main.findAll('tbody tr').map((row) => row.get('th .name').text())).toEqual(['网球场1', '网球场2', '网球场3', '网球场4'])
    const booked = main.get('tr[data-resource="1"] td[data-slot="08:00"]')
    expect(booked.text()).toContain('已被预约')
    expect(booked.get('.person').text()).toBe('张三')
    expect(booked.text()).toContain('待使用')
    expect(main.get('tr[data-resource="3"] td[data-slot="08:00"]').text()).toBe('可预约')
    expect(main.get('tr[data-resource="1"] th').text()).toContain('开放')
  })

  it('停用的场地仍显示，并标明已停用', async () => {
    const { root } = await openAdminApp('/venue-admin/occupancy', {
      prepare: async (h) => {
        const admin = await h.clientFor('admin_tennis')
        await admin.adminUpdateResource(4, { operationalStatus: 'DISABLED' })
      },
    })
    await content(root).get('input[type="date"]').setValue('2026-10-13')
    await flushPromises()

    expect(content(root).get('tr[data-resource="4"] th').text()).toContain('已停用')
    expect(content(root).get('tr[data-resource="4"] td[data-slot="08:00"]').text()).toBe('不开放')
  })
})
