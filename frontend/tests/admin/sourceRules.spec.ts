// FE-5 X2 / X5：管理端新增的源码不写路径字面量（路径只引用 router/paths.ts）、不写颜色字面量（颜色只在 styles/）、不出现禁用术语。
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const SRC = fileURLToPath(new URL('../../src', import.meta.url))

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) {
      walk(path, out)
    } else {
      out.push(path)
    }
  }
  return out
}

function adminFiles(): { path: string; text: string }[] {
  const files = [
    ...walk(join(SRC, 'components/admin')),
    ...walk(join(SRC, 'views/venue-admin')),
    ...walk(join(SRC, 'composables')).filter((path) => /[\\/](admin\w*|impactFlow)\.ts$/.test(path)),
    ...walk(join(SRC, 'utils')).filter((path) => /[\\/](admin\w*|impactDisplay|occupancyDisplay|announcementDisplay|venueSelection)\.ts$/.test(path)),
    join(SRC, 'router/venueAdminNav.ts'),
  ]
  return files.map((path) => ({ path, text: readFileSync(path, 'utf8') }))
}

// 用片段拼出禁用词，避免本文件自己被全仓扫描命中。
const FORBIDDEN = new RegExp(['capa' + 'city', 'conflict_' + 'strategy', 'TIME_' + 'SLOT', 'PARTI' + 'CIPANT', '审' + '批'].join('|'), 'i')

describe('X2 / X5 源码规则', () => {
  it('扫描到了管理端的组件、页面、组合函数和展示工具', () => {
    const names = adminFiles().map((file) => file.path.replaceAll('\\', '/'))

    expect(names.length).toBeGreaterThan(50)
    expect(names.some((name) => name.endsWith('components/admin/AdminShell.vue'))).toBe(true)
    expect(names.some((name) => name.endsWith('composables/impactFlow.ts'))).toBe(true)
    expect(names.some((name) => name.endsWith('utils/adminLogDisplay.ts'))).toBe(true)
  })

  it('X5：没有十六进制或 rgb / hsl 颜色字面量', () => {
    const hits = adminFiles().filter((file) => /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/.test(file.text)).map((file) => file.path)

    expect(hits).toEqual([])
  })

  it('X5：样式引用的是令牌（var(--…)），没有写死的颜色关键字', () => {
    const hits = adminFiles()
      .filter((file) => file.path.endsWith('.vue'))
      .filter((file) => /(?:color|background|border[\w-]*)\s*:\s*(?:white|black|red|blue|green|gray|grey)\b/i.test(file.text))
      .map((file) => file.path)

    expect(hits).toEqual([])
  })

  it('X2：路径只引用 router/paths.ts，源码里没有 /venue-admin 字面量', () => {
    const hits = adminFiles().filter((file) => /['"`]\/venue-admin/.test(file.text)).map((file) => file.path)

    expect(hits).toEqual([])
  })

  it('没有禁用术语', () => {
    const hits = adminFiles().filter((file) => FORBIDDEN.test(file.text)).map((file) => file.path)

    expect(hits).toEqual([])
  })

  it('X1：页面与组件不直接调用 api 的方法，也不导入 api 实现', () => {
    const hits = adminFiles()
      .filter((file) => file.path.endsWith('.vue'))
      .filter((file) => /\bapi\.\w+\(|api\/(mock|http)/.test(file.text))
      .map((file) => file.path)

    expect(hits).toEqual([])
  })
})
