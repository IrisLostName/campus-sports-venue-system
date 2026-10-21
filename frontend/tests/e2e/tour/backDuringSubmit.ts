// TEST-2 K2（FE-8 复审转入）：订场提交进行中按浏览器“后退”离开页面。只观察并记录；
// 只有出现错误状态（错误提示、卡住的“提交中…”、页面脚本异常）或重复提交（同一时段两条预约）才算缺陷。
// 做法：限速让每个请求延迟 2 秒，在确认步骤点“确认预约”后立刻后退；之后核对接口里的预约条数与两个页面的状态。
import { expect } from 'vitest'

import { IPHONE16 } from '../browser/pageDriver'
import { makeHttpTarget } from '../support/httpTarget'
import { openVenueSlots, pickSlot } from '../walkthrough/session'
import { go, login, type Tour } from './tourSession'

const LATENCY_MS = 2000
const COURT = '网球场1'
const START = '14:00'

async function reservationsAtSlot(tour: Tour): Promise<number> {
  const wangwu = makeHttpTarget()
  await wangwu.loginAs('wangwu')
  const page = await wangwu.api.listMyReservations({ scope: 'CURRENT' })
  return page.items.filter((item) => item.resourceName === COURT && item.serviceDate === tour.tomorrow
    && item.startTime === START).length
}

export async function backDuringSubmit(tour: Tour): Promise<void> {
  const { page } = tour
  await login(tour, 'wangwu', IPHONE16)
  await page.waitForText('首页')
  await page.clickText('订场', { within: 'nav[aria-label="主导航"]', exact: false })
  await page.waitFor('location.pathname === "/booking"', '进入订场')
  await openVenueSlots(tour, '网球馆', COURT)
  await pickSlot(tour, COURT, START)
  await page.waitForText('用途（可选）')
  const errorsBefore = tour.pageErrors.length
  await page.throttle(LATENCY_MS)
  await page.clickText('确认预约', { selector: 'button' })
  const submittingSeen = await page.evaluate<boolean>('document.body.innerText.includes("提交中…")')
  await page.historyBack()
  await page.waitFor('location.pathname === "/"', '后退回到首页')
  const afterBack = { path: await page.evaluate<string>('location.pathname'), text: await page.text() }
  await page.waitIdle(LATENCY_MS * 5)
  await page.throttle(null)
  // 同一应用内再次进入订场（不整页刷新）：不应停在确认步骤，也不应有“提交中…”或错误提示。
  await page.clickText('订场', { within: 'nav[aria-label="主导航"]', exact: false })
  await page.waitForText('网球馆')
  const bookingText = await page.text()
  const count = await reservationsAtSlot(tour)
  await go(tour, '/reservation')
  await page.waitForText('预约')
  await page.waitForGone('加载中…')
  const reservationText = await page.text()
  const observation = {
    submittingSeen, afterBack: { path: afterBack.path, homeShown: afterBack.text.includes('首页') },
    reservationsAtSlot: count,
    bookingAfter: { stuckSubmitting: bookingText.includes('提交中…'), confirmStep: bookingText.includes('确认预约') },
    reservationPageShowsIt: reservationText.includes(`${START}–`),
    newPageErrors: tour.pageErrors.slice(errorsBefore),
  }
  tour.record('k2-back-during-submit', observation)
  expect(count, 'K2：同一时段不得有两条预约（重复提交）').toBeLessThanOrEqual(1)
  expect(observation.bookingAfter, 'K2：再次进入订场不应卡在确认步骤或“提交中…”').toEqual({ stuckSubmitting: false, confirmStep: false })
  expect(bookingText.includes('服务器开小差了') || reservationText.includes('服务器开小差了'), 'K2：不应出现错误提示').toBe(false)
  expect(observation.newPageErrors, 'K2：页面脚本不应出错').toEqual([])
}
