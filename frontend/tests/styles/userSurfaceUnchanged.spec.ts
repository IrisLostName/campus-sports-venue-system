// UI-2b-rulings 第 0 节第 3、4 条、第 3 节与计划闸门第 2 条：用户端（手机）没有任何样式文件被修改。
// 1. 用户端页面与组件逐字不变（与 c3865f9 的 SHA-256 相同，换行统一为 LF）；登录页只改标题文字，样式块不变。
// 2. 共用 Ui* 组件只允许把写死的值包成 var(--x, 原值)（原值逐字不变），其余逐行相同；用户端不设这些变量，取原值。
//    fixtures/ui2b-baseline/ui/*.vue.txt 是 c3865f9 的原样副本（加 .txt 后缀，不参与构建与 lint）。
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const FRONTEND = new URL('../../', import.meta.url)
const UI_DIR = new URL('src/components/ui/', FRONTEND)
const BASELINE_UI = new URL('./fixtures/ui2b-baseline/ui/', import.meta.url)

function read(url: URL): string {
  return readFileSync(url, 'utf8').replace(/\r\n/g, '\n')
}

function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex')
}

const HASHES = JSON.parse(read(new URL('./fixtures/ui2b-baseline/user-surface-hashes.json', import.meta.url))) as Record<string, string>

// 当前行是否等于基线行把某一段值 V 包成 var(--名字, V)：前缀相同，其后是 “var(--x, ”，再后是 V + “)” + 基线余下部分。
function isHookWrap(before: string, after: string): boolean {
  let common = 0
  while (common < before.length && before[common] === after[common]) {
    common += 1
  }
  // 包裹的起点不超过公共前缀的末尾（原值本身可能以 var(-- 开头，所以从后往前逐个位置尝试）。
  for (let prefix = common; prefix >= 0; prefix -= 1) {
    const opener = /^var\(--[a-z][a-z-]*, /.exec(after.slice(prefix))
    const inner = opener === null ? null : after.slice(prefix + opener[0].length)
    const rest = before.slice(prefix)
    for (let cut = 1; inner !== null && cut <= rest.length; cut += 1) {
      if (inner === `${rest.slice(0, cut)})${rest.slice(cut)}`) {
        return true
      }
    }
  }
  return false
}

describe('用户端页面与组件逐字不变', () => {
  const entries = Object.entries(HASHES).filter(([key]) => !key.includes('#'))

  it('清单覆盖用户端五个视图与用户端组件', () => {
    expect(entries.filter(([path]) => path.startsWith('src/views/user/'))).toHaveLength(5)
    expect(entries.length).toBeGreaterThan(15)
  })

  it.each(entries)('%s', (path, hash) => {
    expect(sha256(read(new URL(path, FRONTEND)))).toBe(hash)
  })

  it('登录页的样式块不变（只改了标题文字）', () => {
    const source = read(new URL('src/views/LoginView.vue', FRONTEND))
    const style = /<style[^>]*>[\s\S]*?<\/style>/.exec(source)?.[0] ?? ''
    expect(sha256(style)).toBe(HASHES['src/views/LoginView.vue#style'])
  })
})

describe('共用 Ui* 组件：只有 var(--x, 原值) 的包裹改动', () => {
  const baselines = readdirSync(BASELINE_UI).filter((name) => name.endsWith('.vue.txt')).map((name) => name.replace(/\.txt$/, ''))

  it('Ui 目录 = 开工前的 11 个组件 + 新增的 UiIcon.vue', () => {
    expect(baselines).toHaveLength(11)
    expect(readdirSync(UI_DIR).sort()).toEqual([...baselines, 'UiIcon.vue'].sort())
  })

  it.each(baselines)('%s：行数相同，每个不同的行都只是把值包成 var(--x, 原值)', (name) => {
    const before = read(new URL(`${name}.txt`, BASELINE_UI)).split('\n')
    const after = read(new URL(name, UI_DIR)).split('\n')
    expect(after).toHaveLength(before.length)
    before.forEach((line, index) => {
      const current = after[index] ?? ''
      if (current !== line) {
        expect(isHookWrap(line, current), `${name} 第 ${index + 1} 行：${current}`).toBe(true)
      }
    })
  })

  it('包裹判断本身有效：改动原值、改名或多出内容都不算', () => {
    expect(isHookWrap('  min-height: 44px;', '  min-height: var(--control-min-height, 44px);')).toBe(true)
    expect(isHookWrap('  padding: 0 var(--space-5);', '  padding: var(--button-padding, 0 var(--space-5));')).toBe(true)
    expect(isHookWrap('  min-height: 44px;', '  min-height: var(--control-min-height, 40px);')).toBe(false)
    expect(isHookWrap('  min-height: 44px;', '  min-height: 32px;')).toBe(false)
    expect(isHookWrap('  min-height: 44px;', '  min-height: var(--x, 44px) !important;')).toBe(false)
  })
})
