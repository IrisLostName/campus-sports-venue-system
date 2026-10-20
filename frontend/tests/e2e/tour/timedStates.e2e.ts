// TEST-2 依赖真实时钟的状态（裁决第 6 节待定项 2、条件 P2）：K3 取消按钮置灰、CHECKIN_OPEN → IN_USE → CHECKED_OUT。
// 不伪造时间：后端用系统时钟，数据只经 http 客户端与界面产生。只能在“某个网球场时段开始前 15 分钟内”运行：
//   预约 B = 今天开始于 (现在, 现在 + 15 分钟] 的时段 → 可签到；预约 A = B 之后 90 分钟的时段 → 待使用且距开始不足 120 分钟（置灰）。
// 不在窗口内时明确失败并给出下一个窗口，不静默通过。前置同 tour.e2e.ts（重置后的库、-NoSweep）；用法：pnpm test:e2e:timed。
// 午夜后运行（规划窗口 2026-10-20 批准，见 docs/evidence/ACC-M4-02.md 第 5 节）：另设 E2E_TIMED_WINDOW=HH:mm-HH:mm（不跨零点、时长为 90 分钟的整数倍，例如 00:15-03:15），
// 先经界面同源的接口给网球馆追加今天所在星期的这个窗口（只在本次重置后的 e2e 库上存在），再按上面的条件取时段。
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { addDays } from '../../../src/api/mock/timeMath'
import { secondsUntilStart } from '../../../src/utils/cancelDeadline'
import { IPHONE16 } from '../browser/pageDriver'
import { makeHttpTarget, type RecordingTarget } from '../support/httpTarget'
import { capture, closeTour, go, login, openTour, type Theme, type Tour } from './tourSession'

const BOTH: Theme[] = ['light', 'dark']
const CHECKIN_OPEN_SECONDS = 15 * 60
const MIN_LEAD_SECONDS = 60          // 留出下单与进入页面的时间
const SLOT_SECONDS = 90 * 60

interface Pick {
  resourceId: number
  resourceName: string
  startTime: string
}

interface Plan {
  serverNow: string
  checkIn: Pick
  locked: Pick
}

async function serverNow(): Promise<string> {
  return (await makeHttpTarget().api.getDisplaySummary()).generatedAt
}

// 可选（午夜后运行）：E2E_TIMED_WINDOW=HH:mm-HH:mm 时，sysadmin 经前端自己的 http 客户端给网球馆
// 追加“今天（服务端日期）所在星期”的一个每周开放窗口，原有窗口保留；不改时钟、不写数据库。只用于重置后的 e2e 库。
async function addTimedWindow(today: string, record: (label: string, data: unknown) => void): Promise<void> {
  const spec = process.env.E2E_TIMED_WINDOW
  if (spec === undefined || spec === '') {
    return
  }
  const [openTime = '', closeTime = ''] = spec.split('-')
  const [year = 0, month = 1, day = 1] = today.split('-').map(Number)
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay() || 7     // 1 = 周一 … 7 = 周日
  const sys = makeHttpTarget()
  await sys.loginAs('sysadmin')
  const before = (await sys.api.adminGetAvailabilityRules(1)).weekly
  const windows = [...before.map(({ weekday: w, openTime: o, closeTime: c }) => ({ weekday: w, openTime: o, closeTime: c })),
    { weekday, openTime, closeTime }]
  const result = await sys.api.adminReplaceWeeklyRules(1, { windows, onExistingReservations: 'KEEP' })
  record('timed-window', { via: 'http client (sysadmin)', venueId: 1, today, weekday, openTime, closeTime,
    before, applied: result.applied, after: result.data })
}

async function availableAt(user: RecordingTarget, date: string, startTime: string): Promise<Pick | null> {
  const slots = await user.api.getVenueSlots(1, date)
  for (const resource of slots.resources) {
    if (resource.slots.some((slot) => slot.startTime === startTime && slot.status === 'AVAILABLE')) {
      return { resourceId: resource.resourceId, resourceName: resource.resourceName, startTime }
    }
  }
  return null
}

// 找今天开始于 (现在 + 1 分钟, 现在 + 15 分钟] 的网球场时段，且它之后 90 分钟的时段也可预约；找不到时给出下一个窗口。
async function planWindow(user: RecordingTarget): Promise<Plan> {
  const now = await serverNow()
  const today = now.slice(0, 10)
  const slots = await user.api.getVenueSlots(1, today)
  const starts = [...new Set(slots.resources.flatMap((resource) => resource.slots.map((slot) => slot.startTime)))].sort()
  for (const start of starts) {
    const left = secondsUntilStart({ serviceDate: today, startTime: start }, now)
    if (left > MIN_LEAD_SECONDS && left <= CHECKIN_OPEN_SECONDS) {
      const later = starts.find((other) => secondsUntilStart({ serviceDate: today, startTime: other }, now) === left + SLOT_SECONDS)
      const checkIn = await availableAt(user, today, start)
      const locked = later === undefined ? null : await availableAt(user, today, later)
      if (checkIn !== null && locked !== null) {
        return { serverNow: now, checkIn, locked }
      }
    }
  }
  const next = starts.find((start) => secondsUntilStart({ serviceDate: today, startTime: start }, now) > CHECKIN_OPEN_SECONDS)
  throw new Error(`不在运行窗口内（服务端时间 ${now}）。需在某个网球场时段开始前 15 分钟内运行，且其后 90 分钟的时段可预约；`
    + `下一个窗口：${next === undefined ? `${addDays(today, 1)} 07:45` : `${today} 开始于 ${next} 的时段之前 15 分钟`}。`)
}

// 卡片按开始时间区分（两条预约可能在同一场地）。
async function cardShows(tour: Tour, pick: Pick, texts: string[]): Promise<void> {
  const name = JSON.stringify(`${pick.startTime}–`)
  const wanted = JSON.stringify(texts)
  await tour.page.waitFor(`[...document.querySelectorAll('article')].some((card) => card.innerText.includes(${name})
    && ${wanted}.every((text) => card.innerText.includes(text)))`, `${pick.startTime} 的卡片含 ${texts.join('、')}`)
  await tour.page.evaluate(`[...document.querySelectorAll('article')].find((card) => card.innerText.includes(${name})).scrollIntoView({ block: 'center' })`)
}

async function cancelDisabled(tour: Tour, pick: Pick): Promise<boolean> {
  const name = JSON.stringify(`${pick.startTime}–`)
  return tour.page.evaluate<boolean>(`[...[...document.querySelectorAll('article')].find((card) => card.innerText.includes(${name}))
    .querySelectorAll('button')].find((button) => button.innerText.trim() === '取消预约').disabled`)
}

describe('TEST-2 依赖真实时钟的状态（K3 置灰、可签到 → 使用中 → 已签退）', () => {
  let tour: Tour | undefined
  let plan: Plan | undefined
  const wangwu = makeHttpTarget()

  beforeAll(async () => {
    await wangwu.loginAs('wangwu')
    tour = await openTour()
    await addTimedWindow(tour.today, tour.record)
    plan = await planWindow(wangwu)
    tour.record('timed-plan', plan)
    for (const pick of [plan.checkIn, plan.locked]) {
      const reservation = await wangwu.api.createReservation({ resourceId: pick.resourceId, serviceDate: tour.today, startTime: pick.startTime })
      tour.record('timed-setup', { via: 'http client', user: 'wangwu', reservation })
    }
  })

  afterAll(async () => {
    tour?.record('timed-end', { serverNow: await serverNow() })
    await closeTour(tour)
  })

  function ready(): { tour: Tour; plan: Plan } {
    if (tour === undefined || plan === undefined) {
      throw new Error('走查上下文未初始化')
    }
    return { tour, plan }
  }

  it('K3：待使用且距开始不足 120 分钟，“取消预约”置灰并显示说明', async () => {
    const { tour: t, plan: p } = ready()
    await login(t, 'wangwu', IPHONE16)
    await go(t, '/reservation')
    await cardShows(t, p.locked, ['待使用', '已过可取消时间（需在开始前至少 120 分钟取消）'])
    expect(await cancelDisabled(t, p.locked)).toBe(true)
    await capture(t, '41-user-reservation-cancel-locked', { surface: 'user', expect: ['已过可取消时间'], themes: BOTH })
  })

  it('CHECKIN_OPEN → 签到 → IN_USE → 签退 → CHECKED_OUT', async () => {
    const { tour: t, plan: p } = ready()
    const court = p.checkIn
    await cardShows(t, court, ['可签到', '签到'])
    await capture(t, '42-user-reservation-checkin-open', { surface: 'user', expect: ['可签到'], themes: BOTH })
    await t.page.clickText('签到', { within: `article[data-status="CHECKIN_OPEN"]`, selector: 'button' })
    await cardShows(t, court, ['使用中', '签退'])
    await capture(t, '43-user-reservation-in-use', { surface: 'user', expect: ['使用中'], themes: BOTH })
    await t.page.clickText('签退', { within: `article[data-status="IN_USE"]`, selector: 'button' })
    await cardShows(t, court, ['已签退'])
    await capture(t, '44-user-reservation-checked-out', { surface: 'user', expect: ['已签退'], themes: BOTH })
    t.record('timed-captured', { serverNow: await serverNow(), shots: t.shots })
  })
})
