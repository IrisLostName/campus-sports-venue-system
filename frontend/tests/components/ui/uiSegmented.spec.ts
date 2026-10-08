// UI-1 UiSegmented（docs/17 第 6 节）：tabs / pressed 两种语义、选中、点击、保留页面选择器。
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import UiSegmented from '../../../src/components/ui/UiSegmented.vue'

const ITEMS = [{ value: 'login', label: '登录' }, { value: 'register', label: '注册' }]

describe('tabs 语义（登录/注册切换）', () => {
  it('tablist + 每项 role=tab，aria-selected 只有选中项为 true', () => {
    const wrapper = mount(UiSegmented, { props: { items: ITEMS, label: '登录方式', mode: 'tabs', modelValue: 'login' } })

    expect(wrapper.attributes('role')).toBe('tablist')
    expect(wrapper.attributes('aria-label')).toBe('登录方式')
    const tabs = wrapper.findAll('[role="tab"]')
    expect(tabs.map((tab) => tab.text())).toEqual(['登录', '注册'])
    expect(tabs.map((tab) => tab.attributes('aria-selected'))).toEqual(['true', 'false'])
    expect(tabs.map((tab) => tab.attributes('aria-pressed'))).toEqual([undefined, undefined])
    expect(tabs.map((tab) => tab.classes('active'))).toEqual([true, false])
  })

  it('点击另一项：发出 update:modelValue，值为该项的 value', async () => {
    const wrapper = mount(UiSegmented, { props: { items: ITEMS, label: '登录方式', mode: 'tabs', modelValue: 'login' } })

    await wrapper.findAll('[role="tab"]')[1]?.trigger('click')

    expect(wrapper.emitted('update:modelValue')).toEqual([['register']])
  })
})

describe('pressed 语义（日期条、标签）', () => {
  it('group + 每项 aria-pressed，没有 role=tab', () => {
    const wrapper = mount(UiSegmented, { props: { items: ITEMS, label: '范围', modelValue: 'register' } })

    expect(wrapper.attributes('role')).toBe('group')
    expect(wrapper.findAll('[role="tab"]')).toHaveLength(0)
    expect(wrapper.findAll('button').map((button) => button.attributes('aria-pressed'))).toEqual(['false', 'true'])
  })

  it('modelValue 为 null：没有选中项', () => {
    const wrapper = mount(UiSegmented, { props: { items: ITEMS, label: '范围', modelValue: null } })

    expect(wrapper.findAll('button').map((button) => button.classes('active'))).toEqual([false, false])
  })

  it('itemClass 与 valueAttribute：页面保留原有的 .day 与 data-date', () => {
    const wrapper = mount(UiSegmented, {
      props: {
        items: [{ value: '2026-10-12', label: '12', sub: '周一' }, { value: '2026-10-13', label: '13', sub: '周二' }],
        label: '选择日期',
        layout: 'scroll',
        itemClass: 'day',
        valueAttribute: 'data-date',
        modelValue: '2026-10-12',
      },
    })

    const days = wrapper.findAll('.day')
    expect(days.map((day) => day.attributes('data-date'))).toEqual(['2026-10-12', '2026-10-13'])
    expect(days.map((day) => day.classes('active'))).toEqual([true, false])
    expect(days.map((day) => day.text())).toEqual(['12周一', '13周二'])
    expect(wrapper.classes()).toContain('ui-segmented--scroll')
  })

  it('默认 valueAttribute 是 data-value；capsule 布局用玻璃底，scroll 布局不用', () => {
    const capsule = mount(UiSegmented, { props: { items: ITEMS, label: 'x', modelValue: 'login' } })
    const scroll = mount(UiSegmented, { props: { items: ITEMS, label: 'x', layout: 'scroll', modelValue: 'login' } })

    expect(capsule.findAll('button').map((button) => button.attributes('data-value'))).toEqual(['login', 'register'])
    expect(capsule.classes()).toContain('ui-glass')
    expect(scroll.classes()).not.toContain('ui-glass')
  })
})
