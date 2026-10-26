// UI-2b-rulings 已定事项第 3、4 条、第 3 节：index.html 含网站图标链接且文件存在；页面加载前的标题是项目名。
// 图标是项目自己的文件（public/），不从外部加载；apple-touch-icon 是 180×180 的 PNG。
import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { APP_NAME } from '../../src/router/titles'

const FRONTEND = new URL('../../', import.meta.url)
const HTML = readFileSync(new URL('index.html', FRONTEND), 'utf8')

describe('index.html', () => {
  it('SVG 网站图标与 apple-touch-icon 两个链接', () => {
    expect(HTML).toContain('<link rel="icon" type="image/svg+xml" href="/favicon.svg" />')
    expect(HTML).toContain('<link rel="apple-touch-icon" href="/apple-touch-icon.png" />')
  })

  it('标题是项目名', () => {
    expect(APP_NAME).toBe('校园场馆预约与服务管理系统')
    expect(HTML).toContain(`<title>${APP_NAME}</title>`)
  })

  it('不从外部加载任何资源', () => {
    expect(HTML).not.toMatch(/(src|href)="(https?:)?\/\//)
  })
})

describe('public/ 下的图标文件', () => {
  it('favicon.svg 存在，是自包含的 SVG（没有外部引用与脚本）', () => {
    const url = new URL('public/favicon.svg', FRONTEND)
    expect(existsSync(url)).toBe(true)
    const svg = readFileSync(url, 'utf8')
    expect(svg.trimStart().startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true)
    expect(svg).not.toMatch(/<script|href=|url\(/i)
  })

  it('apple-touch-icon.png 存在，是 180×180 的 PNG', () => {
    const url = new URL('public/apple-touch-icon.png', FRONTEND)
    expect(existsSync(url)).toBe(true)
    const png = readFileSync(url)
    expect([...png.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    expect(png.subarray(12, 16).toString('ascii')).toBe('IHDR')
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([180, 180])
  })
})
