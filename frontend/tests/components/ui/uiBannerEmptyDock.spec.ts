// UI-1 UiBanner / UiEmptyState / UiDock（docs/17 第 6 节）。
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import UiBanner from '../../../src/components/ui/UiBanner.vue'
import UiDock from '../../../src/components/ui/UiDock.vue'
import UiEmptyState from '../../../src/components/ui/UiEmptyState.vue'
import type { Tone } from '../../../src/utils/statusTone'

describe('UiBanner', () => {
  it.each(['accent', 'success', 'warning', 'danger', 'neutral'] as Tone[])('tone=%s：带对应的类', (tone) => {
    expect(mount(UiBanner, { props: { tone } }).classes()).toContain(`ui-banner--${tone}`)
  })

  it('role 与页面的类随属性落在根元素；图标是装饰，文字只有插槽内容', () => {
    const banner = mount(UiBanner, {
      props: { tone: 'danger' },
      attrs: { role: 'alert', class: 'error' },
      slots: { default: '<p>该时段已被预约</p>' },
    })

    expect(banner.attributes('role')).toBe('alert')
    expect(banner.classes()).toContain('error')
    expect(banner.find('svg').attributes('aria-hidden')).toBe('true')
    expect(banner.text()).toBe('该时段已被预约')
    expect(banner.find('p').text()).toBe('该时段已被预约')
  })

  it('tag=section：渲染为 section，aria-label 保留', () => {
    const banner = mount(UiBanner, { props: { tone: 'warning', tag: 'section' }, attrs: { 'aria-label': '管理员说明' } })

    expect(banner.element.tagName).toBe('SECTION')
    expect(banner.attributes('aria-label')).toBe('管理员说明')
  })

  it('默认是 <div>，没有 role（由使用处决定）', () => {
    const banner = mount(UiBanner)

    expect(banner.element.tagName).toBe('DIV')
    expect(banner.attributes('role')).toBeUndefined()
  })
})

describe('UiEmptyState', () => {
  it('标题是第一个 <p>，说明是第二个', () => {
    const empty = mount(UiEmptyState, { props: { title: '还没有预约', description: '选一个场馆和时段' } })

    expect(empty.findAll('p').map((node) => node.text())).toEqual(['还没有预约', '选一个场馆和时段'])
  })

  it('没有说明、没有操作：只有标题', () => {
    const empty = mount(UiEmptyState, { props: { title: '暂无当前预约' } })

    expect(empty.findAll('p')).toHaveLength(1)
    expect(empty.find('.action').exists()).toBe(false)
  })

  it('action 插槽有内容才渲染操作区', () => {
    const empty = mount(UiEmptyState, { props: { title: '暂无' }, slots: { action: '<a href="/booking">去订场</a>' } })

    expect(empty.find('.action a').text()).toBe('去订场')
    expect(empty.find('svg').attributes('aria-hidden')).toBe('true')
  })

  it('页面的类落在根元素上', () => {
    expect(mount(UiEmptyState, { props: { title: 'x' }, attrs: { class: 'empty' } }).classes()).toContain('empty')
  })
})

describe('UiDock', () => {
  it('渲染 nav，aria-label 来自 label，条目来自插槽', () => {
    const dock = mount(UiDock, {
      props: { label: '主导航' },
      slots: { default: '<a class="dock-item active" href="/">首页</a><a class="dock-item" href="/me">我的</a>' },
    })

    expect(dock.element.tagName).toBe('NAV')
    expect(dock.attributes('aria-label')).toBe('主导航')
    expect(dock.findAll('a').map((link) => link.text())).toEqual(['首页', '我的'])
    expect(dock.classes()).toContain('ui-glass')
  })
})
