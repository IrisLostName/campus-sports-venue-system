// FE-8 L11（UI-1 N8、FE-6 第 6 节）：Dock 链接、各管理端表格的行内按钮、授权范围复选框、影响对话框单选的可访问名称。
// 规则：名称不为空；以按钮的可见文字开头（WCAG 2.5.3 名称中的标签）；同一张表里可见文字相同的按钮，名称两两不同（带上该行的对象名）。
import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import { PATHS } from '../../src/router/paths'
import { accessibleName, normalizeText } from './a11yName'
import { buttonIn, content, openSysApp } from './sysadmin/support'

vi.mock('../../src/api/index', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/api/index')>()
  const { swappedApi } = await import('./apiSwap')
  return { ...actual, api: swappedApi() }
})

interface Named {
  visible: string
  name: string
}

type Scope = Pick<VueWrapper, 'findAll'>

function namedIn(scope: Scope, selector: string): Named[] {
  return scope.findAll(selector).map((node) => ({ visible: normalizeText(node.text()), name: accessibleName(node.element) }))
}

// 违反规则的控件（空名称、不以可见文字开头、同可见文字下重名）。期望为空数组。
function problemsOf(controls: Named[]): string[] {
  const problems = controls.filter((item) => item.name === '' || !item.name.startsWith(item.visible))
    .map((item) => `名称不合格：可见“${item.visible}”，名称“${item.name}”`)
  const byVisible = new Map<string, string[]>()
  for (const item of controls) {
    byVisible.set(item.visible, [...(byVisible.get(item.visible) ?? []), item.name])
  }
  for (const [visible, names] of byVisible) {
    if (new Set(names).size !== names.length) {
      problems.push(`“${visible}”有重名：${names.join(' | ')}`)
    }
  }
  return problems
}

async function openPageAs(path: string, prepare?: Parameters<typeof openSysApp>[1]) {
  const { root, h } = await openSysApp(path, prepare)
  await flushPromises()
  return { root, h, main: content(root) }
}

describe('用户端 Dock', () => {
  it('四个链接的名称就是可见文字（图标 aria-hidden，不参与名称）', async () => {
    const { mount } = await import('@vue/test-utils')
    const { createMemoryHistory, createRouter } = await import('vue-router')
    const ClientDock = (await import('../../src/components/ClientDock.vue')).default
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [PATHS.home, PATHS.reservation, PATHS.booking, PATHS.me].map((path) => ({ path, component: { render: () => null } })),
    })
    await router.push(PATHS.home)
    const dock = mount(ClientDock, { global: { plugins: [router] } })

    expect(namedIn(dock, 'a').map((item) => item.name)).toEqual(['首页', '预约', '订场', '我的'])
    expect(problemsOf(namedIn(dock, 'a'))).toEqual([])
  })
})

describe('场馆资料表（系统管理员）', () => {
  it('三个场馆行的按钮、链接与开关：名称带场馆名，互不重名', async () => {
    const { main } = await openPageAs(PATHS.sysAdmin)
    const controls = namedIn(main, 'tbody button, tbody a')

    expect(controls).toHaveLength(9)
    expect(problemsOf(controls)).toEqual([])
    expect(controls.filter((item) => item.visible === '编辑资料').map((item) => item.name)).toEqual([
      '编辑资料：网球馆', '编辑资料：羽毛球馆', '编辑资料：游泳馆',
    ])
    expect(namedIn(main, 'tbody input[role="switch"]').map((item) => item.name)).toEqual([
      '对用户开放预约：网球馆', '对用户开放预约：羽毛球馆', '对用户开放预约：游泳馆',
    ])
  })
})

describe('用户表（系统管理员）', () => {
  it('每个账号行的按钮名称带用户名，互不重名', async () => {
    const { main } = await openPageAs(PATHS.sysAdminUsers)
    const controls = namedIn(main, 'tbody button')

    expect(controls.length).toBeGreaterThanOrEqual(7)
    expect(problemsOf(controls)).toEqual([])
    expect(controls.find((item) => item.visible === '改显示名')?.name).toBe('改显示名：zhangsan')
  })
})

describe('授权范围对话框的复选框与影响对话框的单选', () => {
  it('复选框的名称是场馆名；单选的名称是各自的整句说明', async () => {
    const { root, main } = await openPageAs(PATHS.sysAdminAdmins)
    await buttonIn(main.findAll('tbody tr')[0] ?? main, '调整授权').trigger('click')
    const scope = main.get('[role="dialog"]')

    expect(namedIn(scope, 'fieldset input[type="checkbox"]').map((item) => item.name)).toEqual(['网球馆', '羽毛球馆', '游泳馆'])
    expect(scope.get('fieldset legend').text()).toContain('授权场馆')
    root.unmount()
  })

  it('关闭有预约的网球馆：保留 / 取消两个单选都有完整名称，互不相同', async () => {
    const { main } = await openPageAs(PATHS.sysAdmin)
    await buttonIn(main.findAll('tbody tr')[0] ?? main, '关闭场馆').trigger('click')
    await flushPromises()
    const radios = namedIn(main.get('[role="dialog"]'), 'input[type="radio"]')

    expect(radios.map((item) => item.name)).toEqual([
      '保留（KEEP）：预约保持有效，仅阻止新的预约', '取消（CANCEL）：这些预约将被管理员取消',
    ])
  })
})

describe('场地与开放规则页（场地表、特殊关闭、每周窗口）', () => {
  async function openResources() {
    return openPageAs(`${PATHS.sysAdminResources}?venueId=1`, {
      prepare: async (h) => {
        const admin = await h.clientFor('sysadmin')
        await admin.adminAddClosure(1, { startDate: '2026-11-20', endDate: '2026-11-20' })
        await admin.adminAddClosure(1, { startDate: '2026-11-21', endDate: '2026-11-22', resourceId: 2 })
      },
    })
  }

  it('场地表：改名与状态按钮的名称带场地名，互不重名', async () => {
    const { main } = await openResources()
    const table = main.findAll('table').find((node) => node.get('caption').text() === '场地列表')
    const controls = namedIn(table ?? main, 'tbody button')

    expect(controls.length).toBeGreaterThanOrEqual(8)
    expect(problemsOf(controls)).toEqual([])
    expect(controls.find((item) => item.visible === '改名')?.name).toBe('改名：网球场1')
  })

  it('特殊关闭表的“删除”带日期与范围；每周窗口的“删除窗口”带星期与时间', async () => {
    const { main } = await openResources()
    const closures = namedIn(main.get('section[aria-label="特殊关闭"]'), 'tbody button')
    const windows = namedIn(main.get('section[aria-label="每周开放窗口"]'), 'li button')

    expect(closures.map((item) => item.name)).toEqual(['删除：2026-11-20 整馆', '删除：2026-11-21 至 2026-11-22 网球场2'])
    expect(problemsOf(closures)).toEqual([])
    expect(windows).toHaveLength(7)
    expect(windows[0]?.name).toBe('删除窗口：周一 08:00–20:00')
    expect(problemsOf(windows)).toEqual([])
  })
})

describe('预约表、报修表、公告表', () => {
  it('预约表：取消 / 改派场地 / 改派人员的名称带预约人、日期、时间与场地', async () => {
    const { main } = await openPageAs(PATHS.sysAdminReservations)
    const controls = namedIn(main, 'tbody button')

    expect(controls).toHaveLength(6)
    expect(problemsOf(controls)).toEqual([])
    expect(controls.map((item) => item.name)).toContain('取消：张三 2026-10-13 08:00–09:30 网球馆 · 网球场1')
  })

  it('报修表：处理步骤按钮的名称带地点、报修人与提交时间', async () => {
    const { main } = await openPageAs(`${PATHS.sysAdminRepairs}?venueId=1`, {
      prepare: async (h) => {
        await (await h.clientFor('zhangsan')).createRepair({ venueId: 1, description: '灯不亮' })
        await (await h.clientFor('lisi')).createRepair({ venueId: 1, description: '地面积水' })
      },
    })
    const controls = namedIn(main, 'tbody button')

    expect(controls.length).toBeGreaterThanOrEqual(4)
    expect(problemsOf(controls)).toEqual([])
    expect(controls.every((item) => item.name.includes('整个场馆') && /张三|李四/.test(item.name))).toBe(true)
  })

  it('场馆公告表：“归档”带公告标题', async () => {
    const { main } = await openPageAs(`${PATHS.sysAdminVenueAnnouncements}?venueId=1`, {
      prepare: async (h) => {
        const admin = await h.clientFor('sysadmin')
        await admin.adminCreateAnnouncement({ scope: 'VENUE', venueId: 1, title: '雨天闭馆', content: '雨天室外场地关闭' })
      },
    })
    const controls = namedIn(main, 'tbody button')

    expect(controls.length).toBeGreaterThanOrEqual(2)
    expect(problemsOf(controls)).toEqual([])
    expect(controls.map((item) => item.name)).toContain('归档：雨天闭馆')
  })
})
