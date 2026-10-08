// UI-1：docs/17 第 2–5 节的令牌在 tokens.css 中齐全，回退与减少动态效果的规则存在。
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

// 随主题变化的令牌：浅色块、系统深色块、固定深色块都必须各自定义。
const THEMED = [
  '--color-canvas', '--canvas-glow', '--color-surface', '--color-text', '--color-text-secondary', '--color-text-tertiary',
  '--color-separator', '--color-accent', '--color-accent-fill', '--on-accent', '--color-success', '--color-warning',
  '--color-danger', '--color-danger-text', '--color-neutral',
  '--glass-thin', '--glass-regular', '--glass-thick', '--glass-border', '--glass-highlight', '--glass-shadow',
  '--tint-strength', '--color-scrim',
]

// 与主题无关的令牌：在 :root 定义一次，浅色、深色都继承。
const INVARIANT = [
  '--font-family', '--glass-blur', '--glass-blur-admin', '--dock-height', '--dock-offset', '--z-dock', '--z-sheet',
  '--press-scale', '--slide-distance',
  '--font-large-title', '--font-title', '--font-headline', '--font-body', '--font-callout', '--font-footnote', '--font-caption',
  '--radius-sm', '--radius-md', '--radius-lg', '--radius-xl', '--radius-2xl', '--radius-capsule',
  '--space-1', '--space-2', '--space-3', '--space-4', '--space-5', '--space-6', '--space-8',
  '--motion-fast', '--motion-normal', '--motion-slow', '--ease-standard',
]

describe('令牌齐全（docs/17 第 2–5 节）', () => {
  const light = block(':root {')
  const systemDark = block('@media (prefers-color-scheme: dark)')
  const fixedDark = block('[data-theme="dark"] {')

  it.each(THEMED)('%s 在浅色、系统深色、固定深色三处都有定义', (token) => {
    expect(valueOf(light, token), `浅色缺 ${token}`).not.toBeNull()
    expect(valueOf(systemDark, token), `系统深色缺 ${token}`).not.toBeNull()
    expect(valueOf(fixedDark, token), `固定深色缺 ${token}`).not.toBeNull()
  })

  it.each(INVARIANT)('%s 在 :root 定义', (token) => {
    expect(valueOf(light, token), `:root 缺 ${token}`).not.toBeNull()
  })

  it('浅色与深色的关键取值按 docs/17 第 2 节', () => {
    expect(valueOf(light, '--color-accent')).toBe('#0052ad')
    expect(valueOf(light, '--color-accent-fill')).toBe('#0052ad')
    expect(valueOf(light, '--color-danger-text')).toBe('#b3001b')
    expect(valueOf(light, '--color-text-secondary')).toBe('rgba(60, 60, 67, 0.84)')
    for (const dark of [systemDark, fixedDark]) {
      expect(valueOf(dark, '--color-accent')).toBe('#409cff')
      expect(valueOf(dark, '--color-accent-fill')).toBe('#0071e3')
      expect(valueOf(dark, '--color-danger-text')).toBe('#ff7a72')
    }
  })

  it('系统深色块与固定深色块的取值一致（运营大屏与系统深色同一套）', () => {
    for (const token of THEMED) {
      expect(valueOf(systemDark, token), token).toBe(valueOf(fixedDark, token))
    }
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
