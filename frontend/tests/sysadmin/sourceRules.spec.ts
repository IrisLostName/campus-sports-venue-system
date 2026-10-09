// FE-6 X1 / X2 / X3 / X5 与密码规则：系统管理员端新增的源码不写路径字面量、颜色字面量，不出现禁用术语，
// 页面与组件不直接调接口，密码只出现在新建账号的几个文件里、不被打印或存储。
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

function sysFiles(): { path: string; text: string }[] {
  const files = [
    ...walk(join(SRC, 'components/sys-admin')),
    ...walk(join(SRC, 'views/sys-admin')),
    ...walk(join(SRC, 'composables')).filter((path) => /[\\/]sys[A-Z]\w*\.ts$/.test(path)),
    ...walk(join(SRC, 'utils')).filter((path) => /[\\/](sys[A-Z]\w*|fieldLimits)\.ts$/.test(path)),
    join(SRC, 'router/sysAdminNav.ts'),
  ]
  return files.map((path) => ({ path: path.replaceAll('\\', '/'), text: readFileSync(path, 'utf8') }))
}

// 用片段拼出禁用词，避免本文件自己被全仓扫描命中。
const FORBIDDEN = new RegExp(['capa' + 'city', 'conflict_' + 'strategy', 'TIME_' + 'SLOT', 'PARTI' + 'CIPANT', '审' + '批'].join('|'), 'i')

describe('FE-6 源码规则', () => {
  it('扫描到了页面、组件、组合函数、展示工具和导航', () => {
    const names = sysFiles().map((file) => file.path)

    expect(names.length).toBeGreaterThan(30)
    expect(names.some((name) => name.endsWith('views/sys-admin/SysAdminShell.vue'))).toBe(true)
    expect(names.some((name) => name.endsWith('components/sys-admin/users/UserCreateDialog.vue'))).toBe(true)
    expect(names.some((name) => name.endsWith('composables/sysVenueStatus.ts'))).toBe(true)
    expect(names.some((name) => name.endsWith('utils/sysUserDisplay.ts'))).toBe(true)
    expect(names.some((name) => name.endsWith('router/sysAdminNav.ts'))).toBe(true)
  })

  it('X5：没有十六进制或 rgb / hsl 颜色字面量，样式引用令牌', () => {
    const literal = sysFiles().filter((file) => /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/.test(file.text)).map((file) => file.path)
    const keyword = sysFiles()
      .filter((file) => file.path.endsWith('.vue'))
      .filter((file) => /(?:color|background|border[\w-]*)\s*:\s*(?:white|black|red|blue|green|gray|grey)\b/i.test(file.text))
      .map((file) => file.path)

    expect(literal).toEqual([])
    expect(keyword).toEqual([])
  })

  it('X2：路径只引用 router/paths.ts，源码里没有 /sys-admin 或 /venue-admin 字面量', () => {
    const hits = sysFiles().filter((file) => /['"`]\/(sys|venue)-admin/.test(file.text)).map((file) => file.path)

    expect(hits).toEqual([])
  })

  it('没有禁用术语', () => {
    expect(sysFiles().filter((file) => FORBIDDEN.test(file.text)).map((file) => file.path)).toEqual([])
  })

  it('X1：页面与组件不直接调用 api 的方法，也不导入 api 实现；组合函数里的 api 调用都包在 call / run 里', () => {
    const vue = sysFiles()
      .filter((file) => file.path.endsWith('.vue'))
      .filter((file) => /\bapi\.\w+\(|api\/(mock|http)/.test(file.text))
      .map((file) => file.path)
    const bare = sysFiles()
      .filter((file) => file.path.endsWith('.ts'))
      .filter((file) => /await\s+(deps\.)?api\./.test(file.text))
      .map((file) => file.path)

    expect(vue).toEqual([])
    expect(bare).toEqual([])
  })

  it('密码：只在新建账号相关的文件里出现；没有 console 输出，也没有写入 storage', () => {
    const mentions = sysFiles()
      .filter((file) => /password/i.test(file.text.replace(/\/\/.*$/gm, '')))
      .map((file) => file.path.split('/src/')[1])
      .sort()
    const leaks = sysFiles().filter((file) => /console\.|localStorage|sessionStorage|document\.cookie/.test(file.text)).map((file) => file.path)

    expect(mentions).toEqual([
      'components/sys-admin/users/UserCreateDialog.vue',
      'utils/fieldLimits.ts',
      'utils/sysUserDisplay.ts',
    ])
    expect(leaks).toEqual([])
  })

  it('密码框：type="password"、autocomplete="new-password"', () => {
    const dialog = sysFiles().find((file) => file.path.endsWith('UserCreateDialog.vue'))

    expect(dialog?.text).toMatch(/label="密码"\s+type="password"\s+autocomplete="new-password"/)
  })

  it('不修改守卫与 access.ts：它们不依赖任何 sys-admin 新文件', () => {
    const guard = readFileSync(join(SRC, 'router/guard.ts'), 'utf8')
    const access = readFileSync(join(SRC, 'router/access.ts'), 'utf8')

    expect(guard + access).not.toMatch(/sysAdminNav|SYS_ADMIN_NAV/)
  })
})
