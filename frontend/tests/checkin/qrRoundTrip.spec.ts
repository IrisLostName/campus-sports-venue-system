// P2-1c 裁决已定事项第 5 条：解码逻辑用“本项目生成二维码 → 解码”往返测试，不需要摄像头与安卓模拟器。
// utils/qrMatrix 生成模块路径 → 按模块栅格化为 RGBA 像素（含 4 个模块的静区）→ utils/qrDecode（jsQR）解码，得到原码。
import { describe, expect, it } from 'vitest'

import { qrGraphic, type QrGraphic } from '../../src/utils/qrMatrix'
import { decodeQr, type RgbaFrame } from '../../src/utils/qrDecode'

const QUIET = 4

// 模块路径形如 “M{col} {row}h1v1h-1z”。
function darkModules(graphic: QrGraphic): Set<string> {
  return new Set([...graphic.path.matchAll(/M(\d+) (\d+)h1v1h-1z/g)].map((match) => `${match[1]},${match[2]}`))
}

// 每个模块 scale×scale 像素；offset 把码放在更大的画面里（模拟摄像头画面中的一部分）。
function rasterize(graphic: QrGraphic, scale: number, canvas = 0): RgbaFrame {
  const side = (graphic.size + QUIET * 2) * scale
  const width = Math.max(side, canvas)
  const height = width
  const offset = Math.floor((width - side) / 2)
  const data = new Uint8ClampedArray(width * height * 4).fill(255)
  const dark = darkModules(graphic)
  for (let y = 0; y < side; y += 1) {
    for (let x = 0; x < side; x += 1) {
      const col = Math.floor(x / scale) - QUIET
      const row = Math.floor(y / scale) - QUIET
      if (dark.has(`${col},${row}`)) {
        const index = ((y + offset) * width + (x + offset)) * 4
        data[index] = 29
        data[index + 1] = 33
        data[index + 2] = 41
      }
    }
  }
  return { data, width, height }
}

const CODES = [
  '7f3c9a2e-41d8-4b6a-9e15-2c8d0b6f4a91.41',
  '00000000-0000-4000-8000-000000000000.1',
  `ffffffff-ffff-4fff-bfff-ffffffffffff.${'9'.repeat(18)}`,
]

describe('二维码往返：qrMatrix 生成 → jsQR 解码', () => {
  it.each(CODES)('%s', async (code) => {
    const graphic = await qrGraphic(code)
    expect(graphic.size).toBeGreaterThanOrEqual(21)
    expect(await decodeQr(rasterize(graphic, 4))).toBe(code)
  })

  it('码只占 480×480 画面的一部分（与扫码页缩小后的帧相同）时也能解码', async () => {
    const code = CODES[0] as string
    expect(await decodeQr(rasterize(await qrGraphic(code), 3, 480))).toBe(code)
  })

  it('没有二维码的画面返回 null', async () => {
    const blank: RgbaFrame = { data: new Uint8ClampedArray(160 * 160 * 4).fill(255), width: 160, height: 160 }
    expect(await decodeQr(blank)).toBeNull()
  })
})
