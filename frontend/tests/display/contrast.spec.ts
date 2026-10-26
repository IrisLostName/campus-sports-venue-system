// UI-2a-rulings 第 2 节（docs/17 第 2 节）：大屏两种主题下，正文与次要文字在画布、卡片、轨道与各状态浅色底上 ≥ 4.5:1；
// 强调文字（“公告”标签、倒计时）在画布、卡片与强调浅色底上 ≥ 4.5:1；Arco 的 #86909C 不作文字颜色；状态色不作文字颜色。
// 浏览器中的实测值见 docs/evidence/UI-2a.md。
import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const CSS = readFileSync(new URL('../../src/styles/tokens.css', import.meta.url), 'utf8').replace(/\r\n/g, '\n')

function block(selector: string): Record<string, string> {
  const start = CSS.indexOf(`${selector} {`)
  const body = CSS.slice(start, CSS.indexOf('}', start))
  return Object.fromEntries(Array.from(body.matchAll(/(--[\w-]+):\s*([^;]+);/g)).map((match) => [match[1], (match[2] ?? '').trim()]))
}

const LIGHT = block('[data-surface="display"]')
const THEMES = { light: LIGHT, dark: { ...LIGHT, ...block('[data-surface="display"][data-display-theme="dark"]') } }

type Rgba = [number, number, number, number]

function parse(value: string | undefined): Rgba {
  const hex = /^#([0-9a-f]{6})$/i.exec(value ?? '')
  if (hex !== null) {
    const n = Number.parseInt(hex[1] ?? '0', 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1]
  }
  const rgba = /^rgba\(([\d.]+),\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)\)$/.exec(value ?? '')
  if (rgba === null) {
    throw new Error(`无法解析颜色：${value}`)
  }
  return [Number(rgba[1]), Number(rgba[2]), Number(rgba[3]), Number(rgba[4])]
}

function over(top: Rgba, bottom: Rgba): Rgba {
  const mix = (index: 0 | 1 | 2) => top[index] * top[3] + bottom[index] * (1 - top[3])
  return [mix(0), mix(1), mix(2), 1]
}

function luminance([r, g, b]: Rgba): number {
  const channel = (value: number) => {
    const c = value / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

function ratio(text: Rgba, background: Rgba): number {
  const [a, b] = [luminance(over(text, background)), luminance(background)]
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

describe.each(Object.entries(THEMES))('%s 主题', (_name, tokens) => {
  const color = (name: string) => parse(tokens[name])
  const surface = () => color('--color-surface')
  const soft = (tone: string) => over(color(`--display-soft-${tone}`), surface())
  const backgrounds = () => ({
    canvas: color('--color-canvas'), surface: surface(), track: color('--display-track'),
    ...Object.fromEntries(['accent', 'success', 'warning', 'danger', 'neutral'].map((tone) => [`soft-${tone}`, soft(tone)])),
  })

  it.each(['--color-text', '--color-text-secondary'])('%s 在所有背景上 ≥ 4.5:1', (text) => {
    for (const [name, background] of Object.entries(backgrounds())) {
      expect(ratio(color(text), background), `${text} on ${name}`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('--color-accent 在画布、卡片与强调浅色底上 ≥ 4.5:1', () => {
    for (const background of [color('--color-canvas'), surface(), soft('accent')]) {
      expect(ratio(color('--color-accent'), background)).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('#86909C 不是任何文字令牌的取值', () => {
    for (const text of ['--color-text', '--color-text-secondary', '--color-accent']) {
      expect(tokens[text]?.toLowerCase(), text).not.toBe('#86909c')
    }
  })
})

describe('组件不把状态色或三级灰用作文字颜色', () => {
  const dirs = ['../../src/components/display/', '../../src/views/display/'].map((path) => new URL(path, import.meta.url))
  const styles = dirs.flatMap((dir) => readdirSync(dir).filter((name) => name.endsWith('.vue'))
    .map((name) => ({ name, css: /<style[^>]*>([\s\S]*?)<\/style>/.exec(readFileSync(new URL(name, dir), 'utf8'))?.[1] ?? '' })))

  it('color: 只取正文、次要文字、强调色、按钮文字色或图标色', () => {
    // UI-2b 删除了 DisplayIcon.vue（提升为 components/ui/UiIcon.vue）；这条只防止扫描为空。
    expect(styles.length).toBeGreaterThan(7)
    for (const { name, css } of styles) {
      const used = Array.from(css.matchAll(/(?:^|[\s;{])color:\s*([^;]+);/g)).map((match) => (match[1] ?? '').trim())
      for (const value of used) {
        expect(value, name).toMatch(/^var\(--(color-text|color-text-secondary|color-accent|on-accent|display-icon-(blue|orange|green|purple))\)$/)
      }
    }
  })
})
