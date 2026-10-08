// UI-1：docs/17 第 2、3 节与补充令牌的取值逐项钉住（浅色、两处深色），回退与减少动态效果的规则存在。
// 这里不渲染样式（happy-dom 不计算 CSS），只核对样式表文本；渲染结果由浏览器截图验收。
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const CSS = readFileSync(new URL('../../src/styles/tokens.css', import.meta.url), 'utf8')

// 取出以 header 开头的规则块的完整文本（按花括号配对）。
function block(header: string): string {
  const start = CSS.indexOf(header)
  if (start < 0) {
    throw new Error(`tokens.css 中找不到 ${header}`)
  }
  let depth = 0
  for (let i = CSS.indexOf('{', start); i < CSS.length; i += 1) {
    depth += CSS[i] === '{' ? 1 : CSS[i] === '}' ? -1 : 0
    if (depth === 0) {
      return CSS.slice(start, i + 1)
    }
  }
  throw new Error(`${header} 的花括号没有配对`)
}

// 取出令牌的声明值（第一次出现），不存在返回 null。
function valueOf(text: string, token: string): string | null {
  const start = text.indexOf(`${token}:`)
  if (start < 0) {
    return null
  }
  const end = text.indexOf(';', start)
  return text.slice(start + token.length + 1, end).replace(/\s+/g, ' ').trim()
}

// 取出一个块里的全部自定义属性声明（去掉注释，空白折叠），用来整体比较两个深色块。
function declarations(text: string): Record<string, string> {
  const result: Record<string, string> = {}
  for (const match of text.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    const [, name, value] = match
    if (name !== undefined && value !== undefined) {
      result[name] = value.replace(/\s+/g, ' ').trim()
    }
  }
  return result
}

// 比较时忽略空白（docs/17 的写法 rgba(0,0,0,0.88) 与样式表的 rgba(0, 0, 0, 0.88) 等价）。
function compact(value: string | null): string | null {
  return value === null ? null : value.replace(/\s+/g, '')
}

type Row = readonly [token: string, light: string, dark: string]

const GLOW_LIGHT = 'radial-gradient(60% 45% at 15% 10%, rgba(90,160,255,0.32), transparent 70%), '
  + 'radial-gradient(55% 40% at 90% 35%, rgba(80,220,210,0.28), transparent 70%), '
  + 'radial-gradient(60% 45% at 30% 95%, rgba(255,140,190,0.26), transparent 70%)'
const GLOW_DARK = 'radial-gradient(60% 45% at 15% 10%, rgba(90,160,255,0.22), transparent 70%), '
  + 'radial-gradient(55% 40% at 90% 35%, rgba(80,220,210,0.18), transparent 70%), '
  + 'radial-gradient(60% 45% at 30% 95%, rgba(255,140,190,0.18), transparent 70%)'

// docs/17 第 2、3 节两张表与补充令牌段的期望值（按文档写，不引用实现）：[令牌, 浅色, 深色]。
// 数值按样式表的写法去掉末尾的 0（0.40 写作 0.4）。随主题变化的令牌必须在浅色、系统深色、固定深色三处各自定义。
const THEMED: readonly Row[] = [
  ['--color-canvas', '#f2f2f7', '#000000'],
  ['--canvas-glow', GLOW_LIGHT, GLOW_DARK],
  ['--color-surface', '#ffffff', '#1c1c1e'],
  ['--color-text', 'rgba(0,0,0,0.88)', 'rgba(255,255,255,0.92)'],
  ['--color-text-secondary', 'rgba(60,60,67,0.84)', 'rgba(235,235,245,0.62)'],
  ['--color-text-tertiary', 'rgba(60,60,67,0.4)', 'rgba(235,235,245,0.32)'],
  ['--color-separator', 'rgba(60,60,67,0.18)', 'rgba(84,84,88,0.5)'],
  ['--color-accent', '#0052ad', '#409cff'],
  ['--color-accent-fill', '#0052ad', '#0071e3'],
  ['--on-accent', '#ffffff', '#ffffff'],
  ['--color-success', '#34c759', '#30d158'],
  ['--color-warning', '#ff9500', '#ff9f0a'],
  ['--color-danger', '#ff3b30', '#ff453a'],
  ['--color-danger-text', '#b3001b', '#ff7a72'],
  ['--color-neutral', '#8e8e93', '#98989d'],
  ['--glass-thin', 'rgba(255,255,255,0.35)', 'rgba(44,44,46,0.35)'],
  ['--glass-regular', 'rgba(255,255,255,0.55)', 'rgba(44,44,46,0.55)'],
  ['--glass-thick', 'rgba(255,255,255,0.72)', 'rgba(44,44,46,0.72)'],
  ['--glass-border', '1px solid rgba(255,255,255,0.6)', '1px solid rgba(255,255,255,0.12)'],
  ['--glass-highlight', 'inset 0 1px 0 rgba(255,255,255,0.7)', 'inset 0 1px 0 rgba(255,255,255,0.1)'],
  ['--glass-shadow', '0 8px 32px rgba(0,0,0,0.08)', '0 8px 32px rgba(0,0,0,0.4)'],
  ['--tint-strength', '14%', '16%'],
  ['--color-scrim', 'rgba(0,0,0,0.18)', 'rgba(0,0,0,0.5)'],
]

// 与主题无关的令牌：只在 :root 定义一次，深色块要么不重写，要么写成同一个值。
const INVARIANT: ReadonlyArray<readonly [token: string, value: string]> = [
  ['--glass-blur', 'blur(20px) saturate(180%)'],
  ['--glass-blur-admin', 'blur(12px) saturate(160%)'],
  ['--dock-height', '64px'],
  ['--dock-offset', '16px'],
  ['--z-dock', '10'],
  ['--z-sheet', '30'],
  ['--press-scale', '0.97'],
  ['--slide-distance', '24px'],
  ['--phone-width', '393px'],
]

// 第 4、5 节的令牌：这里只核对在 :root 定义（取值由字号、圆角、间距、动效各节的表给出）。
const DEFINED_ONLY = [
  '--font-family',
  '--font-large-title', '--font-title', '--font-headline', '--font-body', '--font-callout', '--font-footnote', '--font-caption',
  '--radius-sm', '--radius-md', '--radius-lg', '--radius-xl', '--radius-2xl', '--radius-capsule',
  '--space-1', '--space-2', '--space-3', '--space-4', '--space-5', '--space-6', '--space-8',
  '--motion-fast', '--motion-normal', '--motion-slow', '--ease-standard',
]

describe('令牌取值（docs/17 第 2、3 节与补充令牌）', () => {
  const light = block(':root {')
  const systemDark = block('@media (prefers-color-scheme: dark)')
  const fixedDark = block('[data-theme="dark"] {')

  it.each(THEMED)('%s：浅色', (token, expectedLight) => {
    expect(compact(valueOf(light, token)), `浅色 ${token}`).toBe(compact(expectedLight))
  })

  it.each(THEMED)('%s：系统深色（prefers-color-scheme: dark）', (token, _light, expectedDark) => {
    expect(compact(valueOf(systemDark, token)), `系统深色 ${token}`).toBe(compact(expectedDark))
  })

  it.each(THEMED)('%s：固定深色（[data-theme="dark"]）', (token, _light, expectedDark) => {
    expect(compact(valueOf(fixedDark, token)), `固定深色 ${token}`).toBe(compact(expectedDark))
  })

  it.each(INVARIANT)('%s 在 :root 取期望值，深色块不改写成别的值', (token, expected) => {
    expect(compact(valueOf(light, token)), `:root ${token}`).toBe(compact(expected))
    for (const dark of [systemDark, fixedDark]) {
      const value = valueOf(dark, token)
      expect(value === null ? compact(expected) : compact(value), `深色块 ${token}`).toBe(compact(expected))
    }
  })

  it.each(DEFINED_ONLY)('%s 在 :root 定义', (token) => {
    expect(valueOf(light, token), `:root 缺 ${token}`).not.toBeNull()
  })

  it('系统深色块与固定深色块逐项一致（运营大屏与系统深色同一套）', () => {
    expect(declarations(systemDark)).toEqual(declarations(fixedDark))
  })
})

describe('回退与减少动态效果（docs/17 第 3、5 节）', () => {
  it('不支持 backdrop-filter：玻璃改为 --color-surface 的 92%', () => {
    const fallback = block('@supports not')
    expect(fallback).toContain('backdrop-filter: blur(1px)')
    for (const token of ['--glass-thin', '--glass-regular', '--glass-thick']) {
      expect(valueOf(fallback, token)).toBe('color-mix(in srgb, var(--color-surface) 92%, transparent)')
    }
  })

  it('减少透明度：玻璃改为实色并去掉模糊，且写在固定深色块之后（否则大屏不退化）', () => {
    const reduce = block('@media (prefers-reduced-transparency: reduce)')
    for (const token of ['--glass-thin', '--glass-regular', '--glass-thick']) {
      expect(valueOf(reduce, token)).toBe('var(--color-surface)')
    }
    expect(valueOf(reduce, '--glass-blur')).toBe('none')
    expect(reduce).toContain('[data-theme="dark"]')
    expect(CSS.indexOf('@media (prefers-reduced-transparency: reduce)')).toBeGreaterThan(CSS.indexOf('[data-theme="dark"] {'))
  })

  it('减少动态效果：时长不超过 --motion-fast，缩放与位移归零', () => {
    const reduce = block('@media (prefers-reduced-motion: reduce)')
    expect(valueOf(reduce, '--motion-normal')).toBe('var(--motion-fast)')
    expect(valueOf(reduce, '--motion-slow')).toBe('var(--motion-fast)')
    expect(valueOf(reduce, '--press-scale')).toBe('1')
    expect(valueOf(reduce, '--slide-distance')).toBe('0px')
  })
})
