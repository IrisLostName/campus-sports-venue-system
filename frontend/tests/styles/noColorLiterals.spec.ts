// UI-1：docs/17 第 8 节第 2 条的常设机器检查——src/styles/ 之外不得出现颜色字面量（十六进制、rgb(、rgba(、hsl(、hsla(）。
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const FRONTEND = fileURLToPath(new URL('../../', import.meta.url))
const SRC = join(FRONTEND, 'src')
const STYLES = join(SRC, 'styles')
const EXTENSIONS = ['.vue', '.ts', '.css', '.html']
const LITERAL = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (path === STYLES) {
      return []
    }
    return statSync(path).isDirectory() ? walk(path) : EXTENSIONS.some((ext) => name.endsWith(ext)) ? [path] : []
  })
}

function offenders(files: string[]): string[] {
  return files.flatMap((file) => readFileSync(file, 'utf8').split('\n')
    .map((text, index) => ({ text, line: index + 1 }))
    .filter(({ text }) => LITERAL.test(text))
    .map(({ line }) => `${relative(FRONTEND, file)}:${line}`))
}

describe('颜色字面量只允许出现在 src/styles/ 内', () => {
  it('src/（不含 styles/）与 index.html 中没有颜色字面量', () => {
    expect(offenders([...walk(SRC), join(FRONTEND, 'index.html')])).toEqual([])
  })

  it('检查本身有效：src/styles/tokens.css 里确实有颜色字面量', () => {
    expect(offenders([join(STYLES, 'tokens.css')]).length).toBeGreaterThan(20)
  })
})
