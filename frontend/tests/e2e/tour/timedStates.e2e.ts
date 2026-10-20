// TEST-2 依赖真实时钟的状态（裁决第 6 节待定项 2、条件 P2）：K3 取消按钮置灰、CHECKIN_OPEN → IN_USE → CHECKED_OUT。
// 不伪造时间：后端用系统时钟，数据只经 http 客户端与界面产生。只能在“某个网球场时段开始前 15 分钟内”运行：
//   预约 B = 今天开始于 (现在, 现在 + 15 分钟] 的时段 → 可签到；预约 A = B 之后 90 分钟的时段 → 待使用且距开始不足 120 分钟（置灰）。
// 不在窗口内时明确失败并给出下一个窗口，不静默通过。前置同 tour.e2e.ts（重置后的库、-NoSweep）；用法：pnpm test:e2e:timed。
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

async function cardShows(tour: Tour, resourceName: string, texts: string[]): Promise<void> {
  const name = JSON.stringify(`网球馆 · ${resourceName}`)
  const wanted = JSON.stringify(texts)
  await tour.page.waitFor(`[...document.querySelectorAll('article')].some((card) => card.innerText.includes(${name})
    && ${wanted}.every((text) => card.innerText.includes(text)))`, `${resourceName} 的卡片含 ${texts.join('、')}`)
  await tour.page.evaluate(`[...document.querySelectorAll('article')].find((card) => card.innerText.includes(${name})).scrollIntoView({ block: 'center' })`)
}

async function cancelDisabled(tour: Tour, resourceName: string): Promise<boolean> {
  const name = JSON.stringify(`网球馆 · ${resourceName}`)
  return tour.page.evaluate<boolean>(`[...[...document.querySelectorAll('article')].find((card) => card.innerText.includes(${name}))
    .querySelectorAll('button')].find((button) => button.innerText.trim() === '取消预约').disabled`)
}

describe('TEST-2 依赖真实时钟的状态（K3 置灰、可签到 → 使用中 → 已签退）', () => {
  let tour: Tour | undefined
  let plan: Plan | undefined
  const wangwu = makeHttpTarget()

  beforeAll(async () => {
    await wangwu.loginAs('wangwu')
    plan = await planWindow(wangwu)
    tour = await openTour()
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
    await cardShows(t, p.locked.resourceName, ['待使用', '已过可取消时间（需在开始前至少 120 分钟取消）'])
    expect(await cancelDisabled(t, p.locked.resourceName)).toBe(true)
    await capture(t, '41-user-reservation-cancel-locked', { surface: 'user', expect: ['已过可取消时间'], themes: BOTH })
  })

  it('CHECKIN_OPEN → 签到 → IN_USE → 签退 → CHECKED_OUT', async () => {
    const { tour: t, plan: p } = ready()
    const court = p.checkIn.resourceName
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
