// UI-1：组件自带的减少透明度 / 减少动态效果规则（docs/17 第 3、5 节）。
// happy-dom 不计算 CSS，这里读 SFC 的样式块文本；规则被删除或改空，测试就会变红。
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function styleOf(file: string): string {
  const source = readFileSync(new URL(`../../src/components/ui/${file}`, import.meta.url), 'utf8')
  const match = /<style[^>]*>([\s\S]*?)<\/style>/.exec(source)
  if (match?.[1] === undefined) {
    throw new Error(`${file} 没有样式块`)
  }
  return match[1]
}

// 取出以 header 开头的规则块的完整文本（按花括号配对），空白折叠为单个空格。
function block(css: string, header: string): string {
  const start = css.indexOf(header)
  if (start < 0) {
    throw new Error(`找不到 ${header}`)
  }
  let depth = 0
  for (let i = css.indexOf('{', start); i < css.length; i += 1) {
    depth += css[i] === '{' ? 1 : css[i] === '}' ? -1 : 0
    if (depth === 0) {
      return css.slice(start, i + 1).replace(/\s+/g, ' ')
    }
  }
  throw new Error(`${header} 的花括号没有配对`)
}

const REDUCED_TRANSPARENCY = '@media (prefers-reduced-transparency: reduce)'
const REDUCED_MOTION = '@media (prefers-reduced-motion: reduce)'

describe('UiSheet 的减少透明度规则', () => {
  it('面板改为实色 --color-surface', () => {
    const rule = block(styleOf('UiSheet.vue'), REDUCED_TRANSPARENCY)

    expect(rule).toContain('.sheet { background-color: var(--color-surface); }')
  })
})

describe('UiButton 的减少透明度与减少动态效果规则', () => {
  it('减少透明度：次要按钮改为实色 --color-surface', () => {
    const rule = block(styleOf('UiButton.vue'), REDUCED_TRANSPARENCY)

    expect(rule).toContain('.ui-button--secondary { background-color: var(--color-surface); }')
  })

  it('减少动态效果：转圈图标不再旋转', () => {
    const rule = block(styleOf('UiButton.vue'), REDUCED_MOTION)

    expect(rule).toContain('.spinner { animation: none; }')
  })
})

describe('UiSegmented 的减少透明度规则（N3）', () => {
  it('选中项加 1px 内嵌分隔线（内嵌阴影，不是 border，不占宽度），且不改字重（FE-8 L6）', () => {
    const rule = block(styleOf('UiSegmented.vue'), REDUCED_TRANSPARENCY)

    expect(rule).toContain(
      '.ui-segmented--capsule .item.active { box-shadow: var(--glass-shadow), inset 0 0 0 1px var(--color-separator); }',
    )
    expect(rule).not.toContain('border')
    expect(rule).not.toContain('font-weight')
  })

  it('正常模式的选中项外观不变：没有描边，字重 600', () => {
    const rule = block(styleOf('UiSegmented.vue'), '.ui-segmented--capsule .item.active {')

    expect(rule).not.toContain('border')
    expect(rule).toContain('font-weight: 600;')
  })
})
