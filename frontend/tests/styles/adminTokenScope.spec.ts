// UI-2b-rulings 第 0 节第 3 条、第 3 节：tokens.css 与 base.css 只在末尾追加；:root、系统深色 :root、[data-theme="dark"]、
// [data-surface="display"] 与 UI-2b 开工前已有的各块逐字不变，所以用户端（手机）与大屏的观感不受影响。
// fixtures/ui2b-baseline/ 下的 tokens.css 与 base.css 是 c3865f9（UI-2b 开工前）的原样副本。
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function read(path: string): string {
  return readFileSync(new URL(path, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
}

const TOKENS = read('../../src/styles/tokens.css')
const TOKENS_BASELINE = read('./fixtures/ui2b-baseline/tokens.css')
const BASE = read('../../src/styles/base.css')
const BASE_BASELINE = read('./fixtures/ui2b-baseline/base.css')

function selectors(css: string): string[] {
  const code = css.replace(/\/\*[\s\S]*?\*\//g, '')
  return Array.from(code.matchAll(/([^{};]+)\{/g)).map((match) => (match[1] ?? '').trim().replace(/\s+/g, ' '))
}

describe('tokens.css：既有各块不变，只追加管理端作用域', () => {
  it('基线含 :root、系统深色、固定深色、管理端、回退块与大屏作用域', () => {
    expect(selectors(TOKENS_BASELINE)).toEqual([
      ':root', '@media (prefers-color-scheme: dark)', ':root', '[data-theme="dark"]', '[data-surface="admin"]',
      '@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px)))', ':root, [data-theme="dark"]',
      '@media (prefers-reduced-transparency: reduce)', ':root, [data-theme="dark"]',
      '@media (prefers-reduced-motion: reduce)', ':root',
      '[data-surface="display"]', '[data-surface="display"][data-display-theme="dark"]',
      '@media (prefers-reduced-motion: reduce)', '[data-surface="display"]',
    ])
  })

  it('现在的 tokens.css 以基线全文开头（逐字相同）', () => {
    expect(TOKENS.length).toBeGreaterThan(TOKENS_BASELINE.length)
    expect(TOKENS.startsWith(TOKENS_BASELINE)).toBe(true)
  })

  it('追加的部分只有管理端浅色块与系统深色下的管理端块', () => {
    expect(selectors(TOKENS.slice(TOKENS_BASELINE.length))).toEqual([
      '[data-surface="admin"]', '@media (prefers-color-scheme: dark)', '[data-surface="admin"]',
    ])
  })

  it('管理端覆盖的字号：正文 14px、页面标题 20px；最小字号令牌仍是 12px', () => {
    const added = TOKENS.slice(TOKENS_BASELINE.length)
    expect(added).toContain('--font-callout: 400 14px/1.5 var(--font-family);')
    expect(added).toContain('--font-title: 600 20px/1.4 var(--font-family);')
    expect(added).not.toContain('--font-caption:')
    expect(TOKENS_BASELINE).toContain('--font-caption: 400 12px/1.4 var(--font-family);')
  })
})

describe('base.css：既有规则不变，只追加大屏或管理端作用域的规则', () => {
  it('现在的 base.css 以基线全文开头（逐字相同）', () => {
    expect(BASE.length).toBeGreaterThan(BASE_BASELINE.length)
    expect(BASE.startsWith(BASE_BASELINE)).toBe(true)
  })

  it('追加的每条规则的选择器都以 [data-surface="display"] 或 [data-surface="admin"] 开头', () => {
    const added = selectors(BASE.slice(BASE_BASELINE.length))
    expect(added.length).toBeGreaterThan(0)
    for (const selector of added) {
      expect(selector).toMatch(/^\[data-surface="(display|admin)"\] /)
    }
  })
})
