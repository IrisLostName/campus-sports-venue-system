// 订场月历的展示口径（UI-3 裁决第 1 节第二层、第 4 节第 1 条）：从今天起滚动 31 天，不翻页；
// 只有 [今天, 今天 + advanceDays) 可选，advanceDays 取自 GET /config/booking-rules，这里不写死。
// 日期加减与星期都按 UTC 字段计算，与浏览器所在时区无关（同 bookingDisplay.addDays）。
import { addDays } from './bookingDisplay'
import { weekdayName } from './reservationDisplay'

export const CALENDAR_SPAN = 31

export const WEEKDAY_HEADERS = ['一', '二', '三', '四', '五', '六', '日'] as const

export interface CalendarDay {
  value: string              // YYYY-MM-DD
  dayOfMonth: number
  monthLabel: string | null  // 范围的第一天与每月 1 日标出月份，如“11月”
  bookable: boolean
  ariaLabel: string          // 10月13日 周二
}

function parts(value: string): [number, number] {
  const [, month, day] = value.split('-').map(Number)
  return [month ?? 0, day ?? 0]
}

export function calendarDays(today: string, advanceDays: number, span: number = CALENDAR_SPAN): CalendarDay[] {
  return Array.from({ length: span }, (_unused, offset) => {
    const value = addDays(today, offset)
    const [month, day] = parts(value)
    const weekday = weekdayName(value)
    return {
      value,
      dayOfMonth: day,
      monthLabel: offset === 0 || day === 1 ? `${month}月` : null,
      bookable: offset < advanceDays,
      ariaLabel: `${month}月${day}日${weekday === null ? '' : ` 周${weekday}`}`,
    }
  })
}

// 周一为每周第一天：0 = 周一 … 6 = 周日。
export function mondayIndex(value: string): number {
  const [year, month, day] = value.split('-').map(Number)
  return (new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1)).getUTCDay() + 6) % 7
}

// 按周排成行；第一行前面、最后一行后面用 null 补齐。
export function calendarWeeks(days: CalendarDay[]): Array<Array<CalendarDay | null>> {
  const first = days[0]
  if (first === undefined) {
    return []
  }
  const cells: Array<CalendarDay | null> = [...Array<null>(mondayIndex(first.value)).fill(null), ...days]
  while (cells.length % 7 !== 0) {
    cells.push(null)
  }
  return Array.from({ length: cells.length / 7 }, (_unused, row) => cells.slice(row * 7, row * 7 + 7))
}

// 置灰日期的简短说明；天数跟着 advanceDays 变。
export function bookableHint(advanceDays: number): string {
  return advanceDays > 0
    ? `可预约今天起 ${advanceDays} 天内（含今天）的日期，其余日期暂不可预约`
    : '暂时没有可预约的日期'
}

// 月历标题下的范围说明：10月12日 – 11月11日
export function rangeText(days: CalendarDay[]): string {
  const first = days[0]
  const last = days[days.length - 1]
  if (first === undefined || last === undefined) {
    return ''
  }
  const label = (day: CalendarDay) => `${parts(day.value)[0]}月${day.dayOfMonth}日`
  return `${label(first)} – ${label(last)}`
}
