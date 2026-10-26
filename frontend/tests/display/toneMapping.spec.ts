// UI-2b-rulings 第 2 节（UI-2a 审计 N6）：大屏 .tone-* 到令牌的映射只在 base.css 的大屏作用域里定义一次，
// 场地方块、标签、环形图与图例共用；各组件的样式块不再各写一份。
import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const BASE = readFileSync(new URL('../../src/styles/base.css', import.meta.url), 'utf8').replace(/\s+/g, ' ')
const DIR = new URL('../../src/components/display/', import.meta.url)
const STYLES = readdirSync(DIR).filter((name) => name.endsWith('.vue'))
  .map((name) => ({ name, css: /<style[^>]*>([\s\S]*?)<\/style>/.exec(readFileSync(new URL(name, DIR), 'utf8'))?.[1] ?? '' }))

const TONES = [
  ['accent', 'var(--color-accent-fill)', 'var(--display-soft-accent)'],
  ['success', 'var(--color-success)', 'var(--display-soft-success)'],
  ['warning', 'var(--color-warning)', 'var(--display-soft-warning)'],
  ['danger', 'var(--color-danger)', 'var(--display-soft-danger)'],
  ['neutral', 'var(--color-neutral)', 'var(--display-soft-neutral)'],
] as const

describe('大屏色调映射', () => {
  it.each(TONES)('base.css 恰好定义一次 .tone-%s', (tone, color, soft) => {
    const rule = `[data-surface="display"] .tone-${tone} { --tone: ${color}; --tone-soft: ${soft}; }`
    expect(BASE.split(rule)).toHaveLength(2)
  })

  it('大屏组件的样式块里没有 .tone-* 或 .legend-dot--* 的定义', () => {
    expect(STYLES.length).toBeGreaterThan(5)
    for (const { name, css } of STYLES) {
      expect(css, name).not.toMatch(/\.tone-\w+\s*\{/)
      expect(css, name).not.toMatch(/\.legend-dot--\w+\s*\{/)
    }
  })

  it('图例圆点取共用的 --tone', () => {
    const legend = STYLES.find(({ name }) => name === 'DisplayLegend.vue')?.css.replace(/\s+/g, ' ') ?? ''
    expect(legend).toContain('background: var(--tone);')
  })
})
