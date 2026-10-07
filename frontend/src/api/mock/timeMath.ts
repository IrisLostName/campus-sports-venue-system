// 日期、时刻、时间戳的纯字符串运算。日期 YYYY-MM-DD，时刻 HH:mm，时间戳 YYYY-MM-DDTHH:mm:ss（均为场馆本地时间）。
import { SLOT_MINUTES } from './bookingRules'

const MS_PER_DAY = 24 * 60 * 60 * 1000
const MS_PER_SECOND = 1000
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/
const TIMESTAMP_LENGTH = 'YYYY-MM-DDTHH:mm:ss'.length

export function isValidDate(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) {
    return false
  }
  const parsed = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value
}

export function isValidTime(value: unknown): value is string {
  return typeof value === 'string' && TIME_PATTERN.test(value)
}

export function dayNumber(date: string): number {
  return Math.round(Date.parse(`${date}T00:00:00Z`) / MS_PER_DAY)
}

export function addDays(date: string, days: number): string {
  return new Date((dayNumber(date) + days) * MS_PER_DAY).toISOString().slice(0, 10)
}

// 周一 = 1 … 周日 = 7（docs/13 第 3.4 节 weekday）。
export function weekdayOf(date: string): number {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay()
  return day === 0 ? 7 : day
}

export function toMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

export function fromMinutes(totalMinutes: number): string {
  const hours = String(Math.floor(totalMinutes / 60)).padStart(2, '0')
  const minutes = String(totalMinutes % 60).padStart(2, '0')
  return `${hours}:${minutes}`
}

export function endTimeOf(startTime: string): string {
  return fromMinutes(toMinutes(startTime) + SLOT_MINUTES)
}

export function dateOf(timestamp: string): string {
  return timestamp.slice(0, 10)
}

export function timeOf(timestamp: string): string {
  return timestamp.slice(11, 16)
}

export function secondsOf(timestamp: string): number {
  return Date.parse(`${timestamp}Z`) / MS_PER_SECOND
}

export function timestampFromSeconds(seconds: number): string {
  return new Date(seconds * MS_PER_SECOND).toISOString().slice(0, TIMESTAMP_LENGTH)
}

export function addMinutes(timestamp: string, minutes: number): string {
  return timestampFromSeconds(secondsOf(timestamp) + minutes * 60)
}

export function addHours(timestamp: string, hours: number): string {
  return addMinutes(timestamp, hours * 60)
}

export function slotSeconds(date: string, time: string): number {
  return secondsOf(`${date}T${time}:00`)
}

// 可预约日期范围 [今天, 今天 + advanceDays)（docs/10 第 1 节第 4 步）。
export function isWithinAdvance(today: string, advanceDays: number, date: string): boolean {
  return date >= today && date < addDays(today, advanceDays)
}
