// 场馆本地时间戳 YYYY-MM-DDTHH:mm:ss，不带时区偏移（docs/12 第 1 节；默认时区 Asia/Shanghai）。
// 同格式的两个时间戳可以直接按字符串比较先后。
const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000   // Asia/Shanghai 恒为 UTC+8，无夏令时
const TIMESTAMP_LENGTH = 'YYYY-MM-DDTHH:mm:ss'.length
const TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/

// 与浏览器所在时区无关：先平移到 UTC+8，再按 UTC 字段输出。
export function nowShanghai(): string {
  return new Date(Date.now() + SHANGHAI_OFFSET_MS).toISOString().slice(0, TIMESTAMP_LENGTH)
}

// 场馆本地“今天”：YYYY-MM-DD，订场的日期选项从它开始（FE-4 B4）。
export function todayShanghai(): string {
  return nowShanghai().slice(0, 'YYYY-MM-DD'.length)
}

export function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && TIMESTAMP_PATTERN.test(value)
}
