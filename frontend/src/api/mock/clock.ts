// 可注入的时钟：返回场馆本地时间戳 YYYY-MM-DDTHH:mm:ss，不带时区偏移（docs/12 第 1 节）。
// 测试注入固定时钟；mock 与业务规则不直接读取真实时间。
export interface Clock {
  now(): string
}

const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000   // Asia/Shanghai 恒为 UTC+8，无夏令时
const TIMESTAMP_LENGTH = 'YYYY-MM-DDTHH:mm:ss'.length

// 与浏览器所在时区无关：先平移到 UTC+8，再按 UTC 字段输出。
export function formatShanghai(date: Date): string {
  return new Date(date.getTime() + SHANGHAI_OFFSET_MS).toISOString().slice(0, TIMESTAMP_LENGTH)
}

export const systemClock: Clock = { now: () => formatShanghai(new Date()) }
