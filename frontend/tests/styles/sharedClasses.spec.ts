// FE-8 L12（FE-5 N5、FE-7 N5）：重复的作用域样式已收敛到 styles/base.css 的共用类。
// 常设机器检查：共用类在 base.css 里定义；各 .vue 的样式块里不再有这些规则的副本；使用它们的模板确实带着共用类。
// （“外观没有变化”由 docs/evidence/FE-8-polish.md 里前后计算样式快照的比对佐证，happy-dom 不计算 CSS。）
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const FRONTEND = fileURLToPath(new URL('../../', import.meta.url))
const SRC = join(FRONTEND, 'src')

function vueFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? vueFiles(path) : name.endsWith('.vue') ? [path] : []
  })
}

const FILES = vueFiles(SRC).map((path) => ({ name: relative(FRONTEND, path).split(sep).join('/'), source: readFileSync(path, 'utf8') }))
const BASE = readFileSync(join(SRC, 'styles/base.css'), 'utf8').replace(/\s+/g, ' ')

function styleOf(source: string): string {
  return (/<style[^>]*>([\s\S]*?)<\/style>/.exec(source)?.[1] ?? '').replace(/\s+/g, ' ')
}

function withStyleRule(selector: string): string[] {
  return FILES.filter(({ source }) => styleOf(source).includes(`${selector} {`)).map(({ name }) => name)
}

function usingClass(name: string): string[] {
  const classAttribute = /class="([^"]*)"/g
  return FILES.filter(({ source }) => Array.from(source.matchAll(classAttribute)).some((match) => (match[1] ?? '').split(' ').includes(name)))
    .map((file) => file.name)
}

describe('base.css 定义共用类', () => {
  it.each([
    ['.section-heading', 'font: var(--font-headline);'],
    ['.section-heading--spaced', 'margin-bottom: var(--space-3);'],
    ['.stack-form', 'display: flex; flex-direction: column; gap: var(--space-3);'],
    ['.sr-only', 'position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap;'],
    ['main.display .display-panel', 'padding: 0.8em 1.2em 1em;'],
    ['.display-panel-title', 'margin: 0 0 0.6em; font-size: 1.5em; font-weight: 600;'],
    ['.display-panel-title--inline', 'margin: 0;'],
  ])('%s', (selector, declarations) => {
    expect(BASE).toContain(`${selector} { ${declarations} }`)
  })
})

describe('各 .vue 的样式块里没有这些规则的副本', () => {
  it('.sr-only 与 .form 不再在任何组件里定义', () => {
    expect(withStyleRule('.sr-only')).toEqual([])
    expect(withStyleRule('.form')).toEqual([])
  })

  it('.heading 只剩 LogTable 的那一份（它是说明文字的样式，与区块标题不同）', () => {
    expect(withStyleRule('.heading')).toEqual(['src/components/admin/logs/LogTable.vue'])
  })

  it('大屏四个面板不再各自定义内边距与标题样式', () => {
    for (const file of ['DisplayNotices', 'DisplayStatusDonut', 'DisplayTrend', 'DisplayVenueGroup']) {
      const style = FILES.find(({ name }) => name === `src/components/display/${file}.vue`)
      expect(style, file).toBeDefined()
      expect(styleOf(style?.source ?? '')).not.toContain('padding: 0.8em 1.2em 1em')
      expect(styleOf(style?.source ?? '')).not.toContain('font-size: 1.5em')
    }
  })
})

describe('模板使用共用类', () => {
  it('区块标题、纵向表单、只供读屏的标题', () => {
    expect(usingClass('section-heading--spaced').sort()).toEqual([
      'src/components/admin/overview/OverviewDaily.vue',
      'src/components/sys-admin/stats/StatsByVenue.vue',
      'src/views/venue-admin/AnnouncementsView.vue',
      'src/views/venue-admin/ResourcesView.vue',
    ])
    expect(usingClass('stack-form')).toHaveLength(6)
    expect(usingClass('sr-only').sort()).toEqual([
      'src/components/admin/AdminDataTable.vue', 'src/components/admin/occupancy/OccupancyGrid.vue',
    ])
  })

  // UI-2a 计划闸门第 5 条：新增的“场地实时状态”环形图面板同样使用共用类。
  it('大屏四个面板都带 display-panel，标题带 display-panel-title', () => {
    expect(usingClass('display-panel').sort()).toEqual([
      'src/components/display/DisplayNotices.vue', 'src/components/display/DisplayStatusDonut.vue',
      'src/components/display/DisplayTrend.vue', 'src/components/display/DisplayVenueGroup.vue',
    ])
    expect(usingClass('display-panel-title')).toHaveLength(4)
  })
})
