// 二维码图形（P2-1 裁决第 4 节答复 1）：只有这里接触 qrcode-generator，并且只用动态 import()，
// 使它单独成块、只在管理端打印视图打开时加载（构建产物中不在用户端入口包内，见 tests/build/qrChunk.spec.ts）。
// 输出 SVG 路径数据，由打印视图自己画 <path>，不用 v-html。

export interface QrGraphic {
  size: number        // 每边模块数，不含静区
  path: string        // 深色模块，每个模块一个 1×1 方块
}

// 纠错等级 M：打印后贴在场地，留一定容错；版本由内容长度自动决定。
export async function qrGraphic(text: string): Promise<QrGraphic> {
  const { default: qrcode } = await import('qrcode-generator')
  const qr = qrcode(0, 'M')
  qr.addData(text, 'Byte')
  qr.make()
  const size = qr.getModuleCount()
  const parts: string[] = []
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (qr.isDark(row, col)) {
        parts.push(`M${col} ${row}h1v1h-1z`)
      }
    }
  }
  return { size, path: parts.join('') }
}
