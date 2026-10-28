// P2-1c 审计 F1（裁决第 8 节第 1 条）：签到码浮层的“关闭”按钮与指示点按钮，点击区至少 44×44（docs/17 第 4 节）；
// 看得见的图形不变：“关闭”圆形 32px，圆点 7×7（当前项 18×7）。读 CheckInCodeSheet.vue 的作用域样式逐条核对。
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const MIN_TARGET_PX = 44

const SOURCE = readFileSync(new URL('../../src/components/reservation/CheckInCodeSheet.vue', import.meta.url), 'utf8')
const STYLE = /<style[^>]*>([\s\S]*)<\/style>/.exec(SOURCE)?.[1] ?? ''

// 选择器恰好为 selector 的那条规则（不含媒体查询里的同名规则）的声明。
function declarations(selector: string): Record<string, string> {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = new RegExp(`(?:^|\\n)${escaped} \\{([^}]*)\\}`).exec(STYLE)
  expect(match, `找不到规则 ${selector}`).not.toBeNull()
  return Object.fromEntries((match?.[1] ?? '').split(';').map((line) => line.split(':').map((part) => part.trim()))
    .filter((pair) => pair.length === 2 && pair[0] !== '') as [string, string][])
}

function px(value: string | undefined): number {
  const match = /^(\d+(?:\.\d+)?)px$/.exec(value ?? '')
  return match === null ? Number.NaN : Number(match[1])
}

describe('签到码浮层的触控区', () => {
  it.each(['.close', '.dot'])('%s 按钮的宽高都不小于 44px', (selector) => {
    const rule = declarations(selector)
    expect(px(rule.width), `${selector} width`).toBeGreaterThanOrEqual(MIN_TARGET_PX)
    expect(px(rule.height), `${selector} height`).toBeGreaterThanOrEqual(MIN_TARGET_PX)
  })

  it('按钮本身不画底色，看得见的图形大小不变：关闭圆形 32px，圆点 7×7、当前项 18px 宽', () => {
    expect(declarations('.close').background).toBe('transparent')
    expect(declarations('.dot').background).toBe('transparent')
    expect([px(declarations('.close-icon').width), px(declarations('.close-icon').height)]).toEqual([32, 32])
    expect([px(declarations('.dot::before').width), px(declarations('.dot::before').height)]).toEqual([7, 7])
    expect(px(declarations('.dot.on::before').width)).toBe(18)
  })

  it('“关闭”的图形在 44×44 的按钮里；指示点的圆点由 ::before 画', () => {
    expect(SOURCE).toMatch(/class="close"[\s\S]*?<span\s+class="close-icon"\s+aria-hidden="true"\s*>×<\/span>/)
    expect(declarations('.dot::before').content).toBe('""')
  })
})
