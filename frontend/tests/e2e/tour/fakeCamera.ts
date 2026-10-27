// P2-1c 裁决第 4 节、第 6 节第 13 条：用浏览器的模拟摄像头启动参数播放含二维码的画面，走一遍管理端扫码页。
// 本项目的 utils/qrMatrix 生成签到码图形 → 写成 640×480 的 Y4M 视频（YUV 4:2:0，白底深色模块）→
// 另开一个无头 Edge：--use-fake-ui-for-media-stream（自动允许权限）、--use-fake-device-for-media-stream、
// --use-file-for-fake-video-capture=<y4m>。摄像头只在 HTTPS 或 localhost 下可用；e2e 的前端在 127.0.0.1，属于安全上下文。
// 无头模式若不接受模拟摄像头文件，调用方记录原因，由审计尝试（裁决第 6 节第 13 条）。
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { qrGraphic } from '../../../src/utils/qrMatrix'
import { launchEdge, type EdgeHandle } from '../browser/edgeProcess'
import { PageDriver } from '../browser/pageDriver'
import { E2E } from '../support/e2eEnv'

const WIDTH = 640
const HEIGHT = 480
const FRAMES = 30
const QUIET = 4
const WHITE = 235
const INK = 16

// 一帧的亮度平面：码居中，尽量大但留出边距。
async function lumaPlane(code: string): Promise<Uint8Array> {
  const graphic = await qrGraphic(code)
  const modules = graphic.size + QUIET * 2
  const scale = Math.floor((HEIGHT - 40) / modules)
  const side = modules * scale
  const left = Math.floor((WIDTH - side) / 2)
  const top = Math.floor((HEIGHT - side) / 2)
  const dark = new Set([...graphic.path.matchAll(/M(\d+) (\d+)h1v1h-1z/g)].map((match) => `${match[1]},${match[2]}`))
  const plane = new Uint8Array(WIDTH * HEIGHT).fill(WHITE)
  for (let y = 0; y < side; y += 1) {
    for (let x = 0; x < side; x += 1) {
      if (dark.has(`${Math.floor(x / scale) - QUIET},${Math.floor(y / scale) - QUIET}`)) {
        plane[(top + y) * WIDTH + left + x] = INK
      }
    }
  }
  return plane
}

// 写出 Y4M 文件并返回路径与所在临时目录。
export async function writeQrVideo(code: string): Promise<{ file: string; dir: string }> {
  const dir = mkdtempSync(join(tmpdir(), 'p21c-camera-'))
  const file = join(dir, 'qr.y4m')
  const luma = await lumaPlane(code)
  const chroma = new Uint8Array((WIDTH / 2) * (HEIGHT / 2)).fill(128)
  const header = Buffer.from(`YUV4MPEG2 W${WIDTH} H${HEIGHT} F15:1 Ip A1:1 C420jpeg\n`, 'ascii')
  const frame = Buffer.concat([Buffer.from('FRAME\n', 'ascii'), luma, chroma, chroma])
  writeFileSync(file, Buffer.concat([header, ...Array.from({ length: FRAMES }, () => frame)]))
  return { file, dir }
}

export interface CameraBrowser {
  edge: EdgeHandle
  page: PageDriver
  close(): Promise<void>
}

// 另开一个带模拟摄像头的无头 Edge（调试端口与走查用的浏览器错开）。
export async function launchCameraBrowser(code: string): Promise<CameraBrowser> {
  const video = await writeQrVideo(code)
  const edge = await launchEdge(E2E.edgePath, E2E.cdpPort + 1, [
    '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${video.file}`,
  ])
  const page = new PageDriver(edge.page, E2E.shotDir)
  await page.start()
  return {
    edge, page,
    async close() {
      await edge.close()
      rmSync(video.dir, { recursive: true, force: true })
    },
  }
}
