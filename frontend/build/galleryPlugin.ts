// 首页图集（UI-6）：浏览器不能列目录，所以在构建时（以及 pnpm dev 时）读取 public/media/gallery/，
// 生成虚拟模块 virtual:home-gallery，默认导出排好序的文件名数组。负责人往目录里放图、重新构建即可，不用改代码。
import { readdirSync } from 'node:fs'
import { resolve } from 'node:path'

import type { Plugin, ViteDevServer } from 'vite'

export const GALLERY_MODULE_ID = 'virtual:home-gallery'
const RESOLVED_ID = `\0${GALLERY_MODULE_ID}`
const IMAGE_EXTENSION = /\.(jpe?g|png|webp)$/i

// 只收图片（扩展名不分大小写）；.gitkeep、README 和其他文件一律忽略。
export function galleryFileNames(names: readonly string[]): string[] {
  return names.filter((name) => !name.startsWith('.') && IMAGE_EXTENSION.test(name)).sort()
}

// 目录不存在时视为空图集（页面不渲染图集）。
export function readGalleryDir(dir: string): string[] {
  try {
    return galleryFileNames(readdirSync(dir, { withFileTypes: true }).filter((entry) => entry.isFile()).map((entry) => entry.name))
  } catch {
    return []
  }
}

export function galleryModuleSource(names: readonly string[]): string {
  return `export default ${JSON.stringify(names)}\n`
}

export function homeGallery(dir: string = resolve(process.cwd(), 'public/media/gallery')): Plugin {
  const galleryDir = resolve(dir)

  // dev 下目录里增删文件：作废虚拟模块并整页刷新。
  function watch(server: ViteDevServer): void {
    server.watcher.add(galleryDir)
    const onChange = (file: string) => {
      if (resolve(file, '..') !== galleryDir) {
        return
      }
      const module = server.moduleGraph.getModuleById(RESOLVED_ID)
      if (module !== undefined) {
        server.moduleGraph.invalidateModule(module)
      }
      server.ws.send({ type: 'full-reload' })
    }
    server.watcher.on('add', onChange)
    server.watcher.on('unlink', onChange)
  }

  return {
    name: 'home-gallery',
    resolveId: (id) => (id === GALLERY_MODULE_ID ? RESOLVED_ID : undefined),
    load: (id) => (id === RESOLVED_ID ? galleryModuleSource(readGalleryDir(galleryDir)) : undefined),
    configureServer: watch,
  }
}
