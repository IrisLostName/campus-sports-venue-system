// FE-2 用户端 Dock（docs/08 第 5 节；docs/01 第 4.1 节）：固定四项、顺序固定、当前路由高亮。
import { mount, type VueWrapper } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it } from 'vitest'

import ClientDock from '../../src/components/ClientDock.vue'

const BLANK = { render: () => null }

async function dockAt(path: string): Promise<VueWrapper> {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: ['/', '/reservation', '/reservation/:id', '/booking', '/me'].map((route) => ({ path: route, component: BLANK })),
  })
  await router.push(path)
  await router.isReady()
  return mount(ClientDock, { global: { plugins: [router] } })
}

function activeLabels(wrapper: VueWrapper): string[] {
  return wrapper.findAll('a').filter((link) => link.classes('active')).map((link) => link.text())
}

describe('Dock 的四项', () => {
  it('固定四项，顺序为 首页 / 预约 / 订场 / 我的，各自链接到自己的路径', async () => {
    const dock = await dockAt('/')
    const links = dock.findAll('a')

    expect(links.map((link) => link.text())).toEqual(['首页', '预约', '订场', '我的'])
    expect(links.map((link) => link.attributes('href'))).toEqual(['/', '/reservation', '/booking', '/me'])
    expect(dock.find('nav').attributes('aria-label')).toBe('主导航')
  })

  it('没有按钮或第五项（管理端入口不在 Dock 里）', async () => {
    const dock = await dockAt('/me')

    expect(dock.findAll('a')).toHaveLength(4)
    expect(dock.findAll('button')).toHaveLength(0)
  })
})

describe('当前路由高亮', () => {
  it.each([
    ['/', '首页'],
    ['/reservation', '预约'],
    ['/booking', '订场'],
    ['/me', '我的'],
  ])('在 %s：只有“%s”高亮', async (path, label) => {
    expect(activeLabels(await dockAt(path))).toEqual([label])
  })

  it('子路径 /reservation/5 仍高亮“预约”，而“首页”不会因为路径以 / 开头而高亮', async () => {
    expect(activeLabels(await dockAt('/reservation/5'))).toEqual(['预约'])
  })

  it('路由切换后高亮跟着变', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: ['/', '/reservation', '/booking', '/me'].map((route) => ({ path: route, component: BLANK })),
    })
    await router.push('/booking')
    const dock = mount(ClientDock, { global: { plugins: [router] } })
    expect(activeLabels(dock)).toEqual(['订场'])

    await router.push('/me')
    expect(activeLabels(dock)).toEqual(['我的'])
  })
})
