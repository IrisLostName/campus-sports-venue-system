// P2-1c 裁决第 1 节：从 feat/P2-1 取用 A2 网站图标——favicon.svg（蓝底 + 黄绿网球）、BrandMark.vue（同一图形，
// 管理端侧栏标志处使用）、品牌颜色只在 styles/brand.css；二维码与取景框的固定颜色令牌也在那里（颜色字面量只在 styles/）。
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const FRONTEND = new URL('../../', import.meta.url)
const read = (path: string) => readFileSync(new URL(path, FRONTEND), 'utf8')

describe('A2 品牌图形', () => {
  it('favicon.svg 是 A2 图形：蓝色圆角底块、黄绿网球、两道蓝色球缝', () => {
    const svg = read('public/favicon.svg')
    expect(svg).toContain('<rect width="32" height="32" rx="7" fill="#165dff"/>')
    expect(svg).toContain('<circle cx="16" cy="16" r="9.5" fill="#c6f432"/>')
    expect(svg).toContain('M9.3 9.3c3.6 3.6 3.6 9.8 0 13.4M22.7 9.3c-3.6 3.6-3.6 9.8 0 13.4')
  })

  it('BrandMark.vue 与 favicon 同一图形，颜色取品牌令牌，装饰用（aria-hidden）', () => {
    const mark = read('src/components/BrandMark.vue')
    expect(mark).toContain('M9.3 9.3c3.6 3.6 3.6 9.8 0 13.4M22.7 9.3c-3.6 3.6-3.6 9.8 0 13.4')
    expect(mark).toContain('aria-hidden="true"')
    expect(mark).toContain('fill: var(--brand-tile)')
    expect(mark).toContain('fill: var(--brand-ball)')
  })

  it('管理端侧栏标志处使用 BrandMark（不再是场地图标）', () => {
    const shell = read('src/components/admin/AdminShell.vue')
    expect(shell).toMatch(/<span class="logo">\s*<BrandMark \/>/)
    expect(shell).not.toContain('<UiIcon name="court" />')
  })

  it('brand.css 由 main.ts 引入，定义品牌、二维码与取景框的固定颜色', () => {
    expect(read('src/main.ts')).toContain("import './styles/brand.css';")
    const css = read('src/styles/brand.css')
    for (const token of ['--brand-tile: #165dff', '--brand-ball: #c6f432', '--qr-paper: #ffffff', '--qr-ink: #1d2129', '--scan-stage', '--scan-frame', '--scan-laser']) {
      expect(css).toContain(token)
    }
    expect(css).not.toContain('--print-')
  })
})
