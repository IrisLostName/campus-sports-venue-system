// 签到码（docs/12 第 4 节 CheckInCode、第 5.7 节；P2-1b 裁决第 2 节）：<用户签到标识 UUID>.<预约 id>。
// 与后端 CheckInCodes 一致：签发一律小写；解析时十六进制大小写都接受，按 UUID 值比较；预约 id 不带前导 0、至多 18 位。
// 用户的签到标识只在这里与签到相关的两个接口中使用，不出现在任何其他返回里。

export const CHECK_IN_CODE_PATTERN =
  /^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\.([1-9][0-9]{0,17})$/

// 随机 v4 UUID。用 getRandomValues 而不是 randomUUID：后者只在安全上下文可用，mock 模式也可能经 http 打开。
export function randomUuid(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export function formatCheckInCode(checkInUuid: string, reservationId: number): string {
  return `${checkInUuid.toLowerCase()}.${reservationId}`
}

// 格式已由调用方校验；不匹配时返回 null。
export function parseCheckInCode(code: string): { checkInUuid: string; reservationId: number } | null {
  const match = CHECK_IN_CODE_PATTERN.exec(code)
  if (match === null) {
    return null
  }
  return { checkInUuid: (match[1] ?? '').toLowerCase(), reservationId: Number(match[2]) }
}
