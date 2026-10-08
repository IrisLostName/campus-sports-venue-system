// UI-1 UiButton（docs/17 第 6 节）：变体、禁用、加载、链接形态的渲染结果。
import { mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it, vi } from 'vitest'

import UiButton from '../../../src/components/ui/UiButton.vue'

describe('变体', () => {
  it('默认是 primary 的 <button type="button">', () => {
    const button = mount(UiButton, { slots: { default: '确认' } })

    expect(button.element.tagName).toBe('BUTTON')
    expect(button.attributes('type')).toBe('button')
    expect(button.classes()).toContain('ui-button--primary')
    expect(button.text()).toBe('确认')
  })

  it.each(['primary', 'secondary', 'destructive', 'plain'] as const)('variant=%s：带对应的类，且只带这一个变体类', (variant) => {
    const classes = mount(UiButton, { props: { variant } }).classes()

    expect(classes).toContain(`ui-button--${variant}`)
    expect(classes.filter((name) => name.startsWith('ui-button--'))).toEqual([`ui-button--${variant}`])
  })

  it('只有 secondary 用玻璃底；primary 不用', () => {
    expect(mount(UiButton, { props: { variant: 'secondary' } }).classes()).toEqual(expect.arrayContaining(['ui-glass', 'ui-glass--thin']))
    expect(mount(UiButton, { props: { variant: 'primary' } }).classes()).not.toContain('ui-glass')
  })

  it('type=submit 与 block', () => {
    const button = mount(UiButton, { props: { type: 'submit', block: true } })

    expect(button.attributes('type')).toBe('submit')
    expect(button.classes()).toContain('ui-button--block')
  })
})

describe('禁用与加载', () => {
  it('可用时没有 disabled 属性，点击会触发监听器', async () => {
    const onClick = vi.fn()
    const button = mount(UiButton, { attrs: { onClick } })

    expect(button.attributes('disabled')).toBeUndefined()
    await button.trigger('click')
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('disabled：有 disabled 属性，点击不触发', async () => {
    const onClick = vi.fn()
    const button = mount(UiButton, { props: { disabled: true }, attrs: { onClick } })

    expect(button.attributes('disabled')).toBeDefined()
    await button.trigger('click')
    expect(onClick).not.toHaveBeenCalled()
  })

  it('loading：禁用、aria-busy、出现装饰性转圈图标，按钮文字不变', async () => {
    const onClick = vi.fn()
    const button = mount(UiButton, { props: { loading: true }, slots: { default: '处理中…' }, attrs: { onClick } })

    expect(button.attributes('disabled')).toBeDefined()
    expect(button.attributes('aria-busy')).toBe('true')
    expect(button.find('svg').attributes('aria-hidden')).toBe('true')
    expect(button.text()).toBe('处理中…')
    await button.trigger('click')
    expect(onClick).not.toHaveBeenCalled()
  })

  it('不在加载：没有转圈图标，也没有 aria-busy', () => {
    const button = mount(UiButton, { slots: { default: '提交' } })

    expect(button.find('svg').exists()).toBe(false)
    expect(button.attributes('aria-busy')).toBeUndefined()
  })
})

describe('链接形态', () => {
  it('传 to：渲染为 <a href>，不是 <button>，文字与外观类保留', async () => {
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/booking', component: { render: () => null } }] })
    await router.push('/booking')
    const link = mount(UiButton, {
      props: { to: '/booking', variant: 'secondary' },
      slots: { default: '去订场' },
      global: { plugins: [router] },
    })

    expect(link.element.tagName).toBe('A')
    expect(link.attributes('href')).toBe('/booking')
    expect(link.text()).toBe('去订场')
    expect(link.classes()).toContain('ui-button--secondary')
    expect(link.find('button').exists()).toBe(false)
  })
})
