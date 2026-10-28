// P2-1c 裁决第 0 节第 3 条：两个新依赖固定确切版本、随前端打包、按需加载——
// qrcode-generator 只在签到码浮层的分包之后加载（utils/qrMatrix 唯一入口），jsqr 只在扫码页的分包之后加载（utils/qrDecode 唯一入口）；
// 构建产物中两者都不在入口包、用户端各页面及它们的静态依赖里；index.html 不引用它们；不从 CDN 加载。
// 改编自 feat/P2-1 的 tests/build/qrChunk.spec.ts。构建用 write: false，不写 dist/。
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build, type Rollup } from 'vite'
import { beforeAll, describe, expect, it } from 'vitest'

const FRONTEND = fileURLToPath(new URL('../../', import.meta.url))
const SRC = join(FRONTEND, 'src')

const LIBRARIES = [
  { name: 'qrcode-generator', version: '2.0.4', gate: 'src/utils/qrMatrix.ts' },
  { name: 'jsqr', version: '1.4.0', gate: 'src/utils/qrDecode.ts' },
] as const

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path) : /\.(ts|vue)$/.test(name) ? [path] : []
  })
}

const rel = (path: string) => relative(FRONTEND, path).split('\\').join('/')
const normalize = (id: string | null | undefined) => (id ?? '').split('\\').join('/')

describe('依赖与源码', () => {
  it('两个依赖都固定确切版本（不带 ^ 或 ~）', () => {
    const manifest = JSON.parse(readFileSync(join(FRONTEND, 'package.json'), 'utf8')) as { dependencies: Record<string, string> }
    for (const library of LIBRARIES) {
      expect(manifest.dependencies[library.name], library.name).toBe(library.version)
    }
  })

  it.each(LIBRARIES)('源码中提到 $name 的只有 $gate，而且是 import()，没有静态导入', ({ name, gate }) => {
    const mentioning = walk(SRC).filter((path) => readFileSync(path, 'utf8').includes(`'${name}'`)).map(rel)
    expect(mentioning).toEqual([gate])
    const text = readFileSync(join(FRONTEND, gate), 'utf8')
    expect(text).toContain(`await import('${name}')`)
    expect(text).not.toMatch(new RegExp(`^import[^(]*'${name}'`, 'm'))
  })

  it('签到码浮层由“预约”页异步加载；扫码页是懒加载的路由页面', () => {
    expect(readFileSync(join(SRC, 'views/user/ReservationView.vue'), 'utf8'))
      .toContain("defineAsyncComponent(() => import('../../components/reservation/CheckInCodeSheet.vue'))")
    expect(readFileSync(join(SRC, 'router/index.ts'), 'utf8'))
      .toContain("checkInScan: () => import('../views/venue-admin/CheckInScanView.vue')")
  })
})

let chunks: Rollup.OutputChunk[] = []
let html = ''

const byFile = (fileName: string) => chunks.find((chunk) => chunk.fileName === fileName)
const has = (chunk: Rollup.OutputChunk, name: string) => chunk.moduleIds.some((id) => normalize(id).includes(`/node_modules/${name}/`) || normalize(id).includes(`/${name}@`))
const holderOf = (name: string) => chunks.filter((chunk) => has(chunk, name))
const chunkOf = (sourceFile: string) => chunks.find((chunk) => normalize(chunk.facadeModuleId).endsWith(sourceFile))
const containing = (sourceFile: string) => chunks.find((chunk) => chunk.moduleIds.some((id) => normalize(id).endsWith(sourceFile)))

// 一个块及其全部静态依赖（浏览器加载它时必然一起下载的块）。
function staticClosure(start: Rollup.OutputChunk): Rollup.OutputChunk[] {
  const seen = new Map<string, Rollup.OutputChunk>()
  const queue = [start]
  while (queue.length > 0) {
    const chunk = queue.pop() as Rollup.OutputChunk
    if (!seen.has(chunk.fileName)) {
      seen.set(chunk.fileName, chunk)
      queue.push(...chunk.imports.map(byFile).filter((item): item is Rollup.OutputChunk => item !== undefined))
    }
  }
  return [...seen.values()]
}

// 两组构建产物测试共用同一次构建。
beforeAll(async () => {
  const result = await build({ root: FRONTEND, logLevel: 'silent', build: { write: false } })
  const outputs = (Array.isArray(result) ? result : [result]).flatMap((item) => ('output' in item ? item.output : []))
  chunks = outputs.filter((item): item is Rollup.OutputChunk => item.type === 'chunk')
  const page = outputs.find((item): item is Rollup.OutputAsset => item.type === 'asset' && item.fileName === 'index.html')
  html = String(page?.source ?? '')
}, 180000)

describe('构建产物', () => {
  it.each(LIBRARIES)('$name 单独成一个动态入口块', ({ name }) => {
    const holders = holderOf(name)
    expect(holders).toHaveLength(1)
    expect(holders[0]?.isEntry).toBe(false)
    expect(holders[0]?.isDynamicEntry).toBe(true)
  })

  it('入口包及其静态依赖不含两个库；index.html 不引用它们，也不从外部加载脚本', () => {
    const entry = chunks.find((chunk) => chunk.isEntry) as Rollup.OutputChunk
    expect(entry).toBeDefined()
    for (const { name } of LIBRARIES) {
      expect(staticClosure(entry).filter((chunk) => has(chunk, name)), name).toEqual([])
      expect(html).not.toContain((holderOf(name)[0] as Rollup.OutputChunk).fileName)
    }
    expect(html).not.toMatch(/(src|href)="(https?:)?\/\//)
  })

  it.each([
    'src/views/user/ClientShell.vue', 'src/views/user/HomeView.vue', 'src/views/user/ReservationView.vue',
    'src/views/user/BookingView.vue', 'src/views/user/MeView.vue', 'src/views/LoginView.vue',
    'src/views/venue-admin/VenueAdminShell.vue', 'src/views/sys-admin/SysAdminShell.vue', 'src/views/display/DisplayView.vue',
  ])('%s 及其静态依赖不含两个库', (sourceFile) => {
    const chunk = chunkOf(sourceFile)
    expect(chunk, sourceFile).toBeDefined()
    for (const { name } of LIBRARIES) {
      expect(staticClosure(chunk as Rollup.OutputChunk).filter((item) => has(item, name)), name).toEqual([])
    }
  })
})

describe('构建产物：两个库的加载路径', () => {
  it('qrcode-generator 只由签到码浮层分包（含 qrMatrix）动态导入；浮层分包只由“预约”页动态导入', () => {
    const holder = holderOf('qrcode-generator')[0] as Rollup.OutputChunk
    const sheet = chunkOf('src/components/reservation/CheckInCodeSheet.vue') as Rollup.OutputChunk
    expect(sheet).toBeDefined()
    expect(sheet.isDynamicEntry).toBe(true)
    const importers = chunks.filter((chunk) => chunk.dynamicImports.includes(holder.fileName))
    expect(importers).toEqual([containing('src/utils/qrMatrix.ts')])
    expect(staticClosure(sheet)).toContain(importers[0])
    expect(chunks.filter((chunk) => chunk.dynamicImports.includes(sheet.fileName)).map((chunk) => normalize(chunk.facadeModuleId).split('/src/')[1]))
      .toEqual(['views/user/ReservationView.vue'])
    expect(chunks.filter((chunk) => chunk.imports.includes(sheet.fileName))).toEqual([])
  })

  it('jsqr 只由扫码页分包（含 qrDecode）动态导入；用户端各页面不会加载扫码页', () => {
    const holder = holderOf('jsqr')[0] as Rollup.OutputChunk
    const scan = chunkOf('src/views/venue-admin/CheckInScanView.vue') as Rollup.OutputChunk
    expect(scan).toBeDefined()
    expect(scan.isDynamicEntry).toBe(true)
    const importers = chunks.filter((chunk) => chunk.dynamicImports.includes(holder.fileName))
    expect(importers).toEqual([containing('src/utils/qrDecode.ts')])
    expect(staticClosure(scan)).toContain(importers[0])
    // jsqr 是 CommonJS：它的块会静态引用扫码页块里的互操作辅助函数；除此之外没有块静态引用扫码页。
    expect(chunks.filter((chunk) => chunk.imports.includes(scan.fileName))).toEqual([holder].filter((chunk) => chunk.imports.includes(scan.fileName)))
    expect(chunks.filter((chunk) => chunk.dynamicImports.includes(scan.fileName)).every((chunk) => chunk.isEntry)).toBe(true)
  })
})
