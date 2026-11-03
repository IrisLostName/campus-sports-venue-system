// UI-6 首页图集：构建时读取 public/media/gallery/ 生成文件名列表（build/galleryPlugin.ts）。
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, describe, expect, it } from 'vitest'

import { galleryFileNames, galleryModuleSource, homeGallery, readGalleryDir } from '../../build/galleryPlugin'

const GALLERY = fileURLToPath(new URL('../../public/media/gallery', import.meta.url))
const temps: string[] = []

function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'ui6-gallery-'))
  temps.push(dir)
  return dir
}

afterEach(() => {
  for (const dir of temps.splice(0)) {
    rmSync(dir, { recursive: true, force: true })
  }
})

describe('扩展名过滤', () => {
  it('只收 .jpg .jpeg .png .webp（不分大小写），其余忽略，结果排序', () => {
    const names = ['b.PNG', 'a.jpg', 'c.JPEG', 'd.webp', 'e.Jpg', '.gitkeep', 'README', 'README.md', 'f.gif', 'g.svg', 'h.jpg.txt', '.hidden.jpg']
    expect(galleryFileNames(names)).toEqual(['a.jpg', 'b.PNG', 'c.JPEG', 'd.webp', 'e.Jpg'])
  })

  it('空目录、只有 .gitkeep 的目录、不存在的目录都得到空列表', () => {
    const empty = tempDir()
    const keepOnly = tempDir()
    writeFileSync(join(keepOnly, '.gitkeep'), '')
    expect(readGalleryDir(empty)).toEqual([])
    expect(readGalleryDir(keepOnly)).toEqual([])
    expect(readGalleryDir(join(empty, 'missing'))).toEqual([])
  })

  it('读取目录时忽略子目录，只列文件', () => {
    const dir = tempDir()
    writeFileSync(join(dir, '2.png'), '')
    writeFileSync(join(dir, '1.jpg'), '')
    mkdirSync(join(dir, 'nested.jpg'))
    expect(readGalleryDir(dir)).toEqual(['1.jpg', '2.png'])
  })
})

describe('虚拟模块', () => {
  it('默认导出文件名数组', () => {
    expect(galleryModuleSource(['1.jpg', '2.jpg'])).toBe('export default ["1.jpg","2.jpg"]\n')
  })

  it('插件把 virtual:home-gallery 解析并加载为目录中的图片列表', async () => {
    const dir = tempDir()
    writeFileSync(join(dir, 'a.jpg'), '')
    writeFileSync(join(dir, 'README'), '')
    const plugin = homeGallery(dir)
    const resolveId = plugin.resolveId as (id: string) => string | undefined
    const load = plugin.load as (id: string) => string | undefined
    const resolved = resolveId('virtual:home-gallery')
    expect(resolved).toBe('\0virtual:home-gallery')
    expect(resolveId('other')).toBeUndefined()
    expect(load(resolved ?? '')).toBe('export default ["a.jpg"]\n')
  })

  it('仓库里的图集目录有图片（随构建发布）', () => {
    expect(readGalleryDir(GALLERY).length).toBeGreaterThan(0)
  })
})
