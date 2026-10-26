// UI-2b-rulings 第 0 节第 5 条：管理端正文对比度 ≥ 4.5:1（浅色与系统深色），状态色不作文字颜色。
// 读 tokens.css 末尾的管理端两块（深色块在浅色块之上覆盖），半透明颜色先叠到卡片底色上再算 WCAG 对比度。
// 浏览器里的实测值见 docs/evidence/UI-2b.md。
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const CSS = readFileSync(new URL('../../src/styles/tokens.css', import.meta.url), 'utf8').replace(/\r\n/g, '\n')

// 末尾追加的管理端块：浅色块与 @media (prefers-color-scheme: dark) 里的管理端块。
function declarationsAfter(marker: string): Record<string, string> {
  const start = CSS.lastIndexOf(marker)
  const end = CSS.indexOf('}', start)
  const result: Record<string, string> = {}
  for (const match of CSS.slice(start, end).replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    result[match[1] ?? ''] = (match[2] ?? '').trim()
  }
  return result
}

const LIGHT = declarationsAfter('[data-surface="admin"] {\n  color-scheme: light;')
const DARK = { ...LIGHT, ...declarationsAfter('  [data-surface="admin"] {\n    color-scheme: dark;') }

type Rgba = [number, number, number, number]

function parse(value: string): Rgba {
  const hex = /^#([0-9a-f]{6})$/i.exec(value)
  if (hex !== null) {
    const n = Number.parseInt(hex[1] ?? '0', 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1]
  }
  const rgba = /^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/.exec(value)
  if (rgba !== null) {
    return [Number(rgba[1]), Number(rgba[2]), Number(rgba[3]), Number(rgba[4])]
  }
  throw new Error(`不是颜色字面量：${value}`)
}

function over(top: Rgba, bottom: Rgba): Rgba {
  const a = top[3]
  return [top[0] * a + bottom[0] * (1 - a), top[1] * a + bottom[1] * (1 - a), top[2] * a + bottom[2] * (1 - a), 1]
}

function luminance([r, g, b]: Rgba): number {
  const channel = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

function contrast(text: Rgba, background: Rgba): number {
  const [hi, lo] = [luminance(over(text, background)), luminance(background)].sort((x, y) => y - x)
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05)
}

const BACKGROUNDS = ['--color-canvas', '--color-surface', '--admin-fill-1', '--admin-fill-2', '--admin-soft-accent']
const PAIRS: ReadonlyArray<readonly [text: string, backgrounds: string[]]> = [
  ['--color-text', BACKGROUNDS],
  ['--color-text-secondary', BACKGROUNDS],
  ['--color-accent', ['--color-canvas', '--color-surface', '--admin-soft-accent']],
  ['--on-accent', ['--color-accent-fill']],
  ['--color-danger-text', ['--color-surface']],
]

describe.each([['浅色', LIGHT], ['系统深色', DARK]] as const)('%s：管理端文字对比度 ≥ 4.5:1', (_name, tokens) => {
  const surface = parse(tokens['--color-surface'] ?? '')
  const color = (token: string) => over(parse(tokens[token] ?? ''), surface)

  it.each(PAIRS)('%s', (text, backgrounds) => {
    for (const background of backgrounds) {
      expect(contrast(parse(tokens[text] ?? ''), color(background)), `${text} / ${background}`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('三级灰与状态色不是任何文字令牌的取值', () => {
    const statusValues = ['--color-success', '--color-warning', '--color-danger', '--color-neutral', '--color-text-tertiary']
      .map((token) => tokens[token]?.toLowerCase())
    for (const text of ['--color-text', '--color-text-secondary', '--color-accent']) {
      expect(statusValues).not.toContain(tokens[text]?.toLowerCase())
    }
  })
})

describe('管理端组件不把状态色或三级灰用作文字颜色', () => {
  const SRC = fileURLToPath(new URL('../../src/', import.meta.url))
  const DIRS = ['components/admin', 'components/sys-admin', 'views/venue-admin', 'views/sys-admin'].map((dir) => join(SRC, dir))

  function vueFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
      const path = join(dir, name)
      return statSync(path).isDirectory() ? vueFiles(path) : name.endsWith('.vue') ? [path] : []
    })
  }

  const styles = DIRS.flatMap(vueFiles).map((path) => ({ path, css: /<style[^>]*>([\s\S]*?)<\/style>/.exec(readFileSync(path, 'utf8'))?.[1] ?? '' }))

  it('color: 只取正文、次要文字、强调色或按钮文字色', () => {
    expect(styles.length).toBeGreaterThan(30)
    for (const { path, css } of styles) {
      for (const match of css.matchAll(/(?:^|[\s;{])color:\s*([^;]+);/g)) {
        expect((match[1] ?? '').trim(), path).toMatch(/^var\(--(color-text|color-text-secondary|color-accent|on-accent|color-danger-text)\)$/)
      }
    }
  })
})
