// UI-1 UiGlassCard（docs/17 第 6 节）：材质、元素、内边距与圆角取令牌档位。
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import UiGlassCard from '../../../src/components/ui/UiGlassCard.vue'

describe('材质', () => {
  it('默认是 <div>、regular 玻璃、padding 4、radius xl', () => {
    const card = mount(UiGlassCard, { slots: { default: '内容' } })

    expect(card.element.tagName).toBe('DIV')
    expect(card.classes()).toEqual(expect.arrayContaining(['ui-glass', 'ui-glass--regular', 'ui-glass-card--pad-4', 'ui-glass-card--radius-xl']))
    expect(card.text()).toBe('内容')
  })

  it.each(['thin', 'regular', 'thick'] as const)('material=%s：玻璃，带对应的材质类', (material) => {
    const classes = mount(UiGlassCard, { props: { material } }).classes()

    expect(classes).toEqual(expect.arrayContaining(['ui-glass', `ui-glass--${material}`]))
  })

  it('material=solid：实色表面，不带任何玻璃类', () => {
    const classes = mount(UiGlassCard, { props: { material: 'solid' } }).classes()

    expect(classes).toContain('ui-glass-card--solid')
    expect(classes.filter((name) => name.startsWith('ui-glass') && !name.startsWith('ui-glass-card'))).toEqual([])
  })
})

describe('元素与档位', () => {
  it.each(['section', 'article', 'li', 'form'])('tag=%s：渲染为该元素', (tag) => {
    expect(mount(UiGlassCard, { props: { tag } }).element.tagName).toBe(tag.toUpperCase())
  })

  it.each([0, 2, 3, 4, 5, 6, 8] as const)('padding=%s', (padding) => {
    expect(mount(UiGlassCard, { props: { padding } }).classes()).toContain(`ui-glass-card--pad-${padding}`)
  })

  it.each(['sm', 'md', 'lg', 'xl', '2xl'] as const)('radius=%s', (radius) => {
    expect(mount(UiGlassCard, { props: { radius } }).classes()).toContain(`ui-glass-card--radius-${radius}`)
  })

  it('其余属性与类落到根元素上（页面保留原有的 class 与 aria-label）', () => {
    const card = mount(UiGlassCard, { props: { tag: 'section' }, attrs: { class: 'summary', 'aria-label': '最近的预约' } })

    expect(card.classes()).toContain('summary')
    expect(card.attributes('aria-label')).toBe('最近的预约')
  })
})
