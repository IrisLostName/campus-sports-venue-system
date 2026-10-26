// UI-2a-rulings 第 0 节第 3 条、第 4 节：tokens.css 只在末尾新增大屏作用域；:root、系统深色、[data-theme="dark"]、
// [data-surface="admin"] 与各回退块逐字不变，所以用户端的观感不受影响。UI-2b 在其后追加管理端作用域（UI-2b-rulings 第 0 节第 3 条）。
// fixtures/tokens-baseline.css 是 d14d066（UI-2a 开工前）tokens.css 的原样副本。
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function read(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
}

const CURRENT = read('../../src/styles/tokens.css')
const BASELINE = read('./fixtures/tokens-baseline.css')

function selectors(css: string): string[] {
  const code = css.replace(/\/\*[\s\S]*?\*\//g, '')
  return Array.from(code.matchAll(/([^{};]+)\{/g)).map((match) => (match[1] ?? '').trim().replace(/\s+/g, ' '))
}

describe('既有令牌不变', () => {
  it('基线包含 :root、系统深色、固定深色子树、管理端与回退块', () => {
    expect(selectors(BASELINE)).toEqual([
      ':root', '@media (prefers-color-scheme: dark)', ':root', '[data-theme="dark"]', '[data-surface="admin"]',
      '@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)))', ':root, [data-theme="dark"]',
      '@media (prefers-reduced-transparency: reduce)', ':root, [data-theme="dark"]',
      '@media (prefers-reduced-motion: reduce)', ':root',
    ])
  })

  it('现在的 tokens.css 以基线全文开头（逐字相同），改动只在其后追加', () => {
    expect(CURRENT.length).toBeGreaterThan(BASELINE.length)
    expect(CURRENT.startsWith(BASELINE)).toBe(true)
  })

  it('追加的部分先是大屏作用域（浅色、深色与减少动效三块），其后只有 UI-2b 的管理端作用域（浅色与系统深色）', () => {
    expect(selectors(CURRENT.slice(BASELINE.length))).toEqual([
      '[data-surface="display"]',
      '[data-surface="display"][data-display-theme="dark"]',
      '@media (prefers-reduced-motion: reduce)',
      '[data-surface="display"]',
      '[data-surface="admin"]',
      '@media (prefers-color-scheme: dark)',
      '[data-surface="admin"]',
    ])
  })
})
