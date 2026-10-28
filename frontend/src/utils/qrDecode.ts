// 二维码解码（P2-1c 裁决已定事项第 4 条）：只有这里接触 jsQR（jsqr@1.4.0，Apache-2.0），并且只用动态 import()，
// 使它单独成块、只在管理端扫码页开始解码时加载（构建产物中不在入口包与用户端各页面内，见 tests/build/qrChunks.spec.ts）。
// 不依赖浏览器的 BarcodeDetector（Windows 上的 Chrome / Edge 不支持）。

export interface RgbaFrame {
  data: Uint8ClampedArray   // RGBA，每像素 4 字节
  width: number
  height: number
}

// 解码一帧；没有可识别的二维码时返回 null。摄像头画面是浅底深码，不尝试反色以节省时间。
export async function decodeQr(frame: RgbaFrame): Promise<string | null> {
  const { default: jsQR } = await import('jsqr')
  const result = jsQR(frame.data, frame.width, frame.height, { inversionAttempts: 'dontInvert' })
  return result === null || result.data === '' ? null : result.data
}
