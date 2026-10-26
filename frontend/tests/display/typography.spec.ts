// FE-8 L13（FE-7 N3）：大屏的字号下限与撑满高度。happy-dom 不计算 CSS，所以读 SFC 的样式块文本：
// 根字号 clamp 的下限是 12px（--font-caption），各处用 em 且倍数都不小于 1，所以任何分辨率下最小字号都不低于 12px。
// 1366×768 / 1920×1080 下的实测结果（最小计算字号、下方留白）见 docs/evidence/FE-8-polish.md。
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// UI-2a 新增的大屏组件同样受 12px 下限约束。
const FILES = [
  'views/display/DisplayView.vue',
  'components/display/DisplayIcon.vue',
  'components/display/DisplayLegend.vue',
  'components/display/DisplayMetrics.vue',
  'components/display/DisplayNotices.vue',
  'components/display/DisplayStatusDonut.vue',
  'components/display/DisplayToolbar.vue',
  'components/display/DisplayTrend.vue',
  'components/display/DisplayVenueGroup.vue',
]

function styleOf(path: string): string {
  const source = readFileSync(new URL(`../../src/${path}`, import.meta.url), 'utf8')
  return (/<style[^>]*>([\s\S]*?)<\/style>/.exec(source)?.[1] ?? '').replace(/\s+/g, ' ')
}

const BASE = readFileSync(new URL('../../src/styles/base.css', import.meta.url), 'utf8')

function fontSizes(css: string): string[] {
  return Array.from(css.matchAll(/font-size:\s*([^;}]+)/g)).map((match) => (match[1] ?? '').trim())
}

describe('字号下限 12px', () => {
  it('根字号是 clamp(12px, …)：下限正好是 --font-caption 的 12px', () => {
    expect(styleOf('views/display/DisplayView.vue')).toContain('font-size: clamp(12px, 0.85vw, 18px)')
  })

  it('大屏各处的字号只用 em，倍数都不小于 1（没有 0.95em 之类会跌破 12px 的值，也没有 px / rem 的字面量）', () => {
    const sizes = [...FILES.flatMap((file) => fontSizes(styleOf(file))), ...fontSizes(BASE.slice(BASE.indexOf('main.display')))]
      .filter((size) => !size.startsWith('clamp('))

    expect(sizes.length).toBeGreaterThan(10)
    for (const size of sizes) {
      expect(size, size).toMatch(/^[\d.]+em$/)
      expect(Number.parseFloat(size), size).toBeGreaterThanOrEqual(1)
    }
  })
})

describe('撑满可用高度', () => {
  it('主体 .body 占满标题与指标行之后的高度，两栏等高', () => {
    const css = styleOf('views/display/DisplayView.vue')

    expect(css).toContain('.display { display: flex; flex-direction: column; gap: 1em; min-height: 100vh;')
    expect(css).toMatch(/\.body \{ display: grid; flex: 1; grid-template-columns: [^}]*align-items: stretch; \}/)
  })

  it('场馆面板平分多出来的高度，趋势面板与柱子随右栏变高（最低仍是 12em）', () => {
    expect(styleOf('components/display/DisplayVenueGroup.vue')).toContain('.venue { display: flex; flex: 1 1 auto; flex-direction: column; }')
    const trend = styleOf('components/display/DisplayTrend.vue')

    expect(trend).toContain('.trend { display: flex; flex: 1 1 auto; flex-direction: column; }')
    expect(trend).toContain('flex: 1; min-height: 12em;')
    expect(trend).not.toContain(' height: 12em;')
  })
})
