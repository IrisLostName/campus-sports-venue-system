// 演示主线第 6、8、9 步（docs/04 第 2 节）：通用性三点、系统管理员端、运营大屏。
import { expect } from 'vitest'

import { DEMO_PASSWORD } from '../../../src/api/mock/seed'
import { addDays } from '../../../src/api/mock/timeMath'
import { formatRate } from '../../../src/utils/displayModel'
import { DESKTOP, MOBILE } from '../browser/pageDriver'
import { E2E } from '../support/e2eEnv'
import { makeHttpTarget } from '../support/httpTarget'
import { DIALOG } from './adminSteps'
import { loginUi, openVenueSlots, pickSlot, shot, visit, type Walk } from './session'

// V100 种子用户的用户名与姓名：大屏上一个都不能出现（BE-8 裁决 P4）。
const SEED_PEOPLE = [
  'zhangsan', 'lisi', 'wangwu', 'zhaoliu', 'admin_tennis', 'admin_pool', 'sysadmin',
  '张三', '李四', '王五', '赵六', '网球馆管理员', '游泳羽毛球馆管理员', '系统管理员',
]

async function poolLanes(walk: Walk): Promise<void> {
  const { page } = walk
  await loginUi(walk, 'admin_pool', DESKTOP)
  await visit(walk, '/venue-admin/resources?venueId=3')
  await page.waitForText('泳道6')
  await page.fill('场地数量', '8')
  await page.fill('名称前缀（可选）', '泳道')
  await page.setControl('场地类型（可选）', '泳道')
  await page.clickText('设定数量', { selector: 'button' })
  await page.waitForText('将场地数量设为 8')
  await shot(walk, '10-06a-pool-lane-count-dialog')
  await page.clickText('确认', { within: DIALOG, selector: 'button' })
  await page.waitForText('泳道8')
  await shot(walk, '10-06b-pool-lanes')
}

async function enableBookingAndAddVenue(walk: Walk): Promise<void> {
  const { page } = walk
  await loginUi(walk, 'sysadmin', DESKTOP)
  await page.waitForText('场馆列表')
  await page.clickText('对用户开放预约：游泳馆', { selector: 'input[role="switch"]' })
  await page.waitForText('游泳馆已对用户开放预约')
  await shot(walk, '10-06d-sa-enable-booking')
  await page.fill('名称', '篮球馆（演示）')
  await page.setControl('类型', '篮球')
  await page.clickText('新增场馆', { selector: 'button[type="submit"]' })
  await page.waitFor('[...document.querySelectorAll("td")].some((cell) => cell.innerText.trim() === "篮球馆（演示）")', '新场馆出现在列表中')
  await shot(walk, '10-06e-sa-new-venue')
}

export async function step6Generality(walk: Walk): Promise<void> {
  const { page } = walk
  await poolLanes(walk)
  await loginUi(walk, 'zhaoliu', MOBILE)
  await visit(walk, '/booking')
  await page.waitForText('暂未开放预约')
  await shot(walk, '10-06c-user-venues-not-open')
  await enableBookingAndAddVenue(walk)
  await loginUi(walk, 'zhaoliu', MOBILE)
  await visit(walk, '/booking')
  await openVenueSlots(walk, '游泳馆', '泳道1')
  await shot(walk, '10-06f-user-pool-slots')
  await pickSlot(walk, '泳道1', '09:00')
  await page.waitForText('用途（可选）')
  await page.clickText('确认预约', { selector: 'button' })
  await page.waitForText('预约成功')
  await shot(walk, '10-06g-user-pool-booked')
}

async function grantScope(walk: Walk): Promise<void> {
  const { page } = walk
  await visit(walk, '/sys-admin/admins')
  await page.clickText('调整授权：admin_pool', { selector: 'button' })
  await page.waitForText('调整授权范围')
  await page.clickText('篮球馆（演示）', { within: DIALOG, selector: 'label' })
  await shot(walk, '10-08a-admin-scope-dialog')
  await page.clickText('保存', { within: DIALOG, selector: 'button' })
  await page.waitForGone('调整授权范围')
  await page.waitForText('篮球馆（演示）')
  await shot(walk, '10-08b-admin-scopes')
}

async function publishNotice(walk: Walk): Promise<void> {
  const { page } = walk
  await visit(walk, '/sys-admin/announcements')
  await page.fill('标题', '周六网球场维护通知（演示）')
  await page.fill('内容', '本周六 08:00–09:30 网球场1 球网维修，期间暂停预约。')
  await page.clickText('发布', { selector: 'button[type="submit"]' })
  await page.waitFor('[...document.querySelectorAll("td")].some((cell) => cell.innerText.includes("周六网球场维护通知（演示）"))', '公告出现在列表中')
  await shot(walk, '10-08c-system-announcement')
}

// 统计区间含明天，使利用率不为 0；同时记录后端原始 JSON（K5：0.0、1.0、科学计数法、null）。
async function globalStats(walk: Walk): Promise<void> {
  const { page } = walk
  const dateFrom = addDays(walk.today, -6)
  await visit(walk, '/sys-admin/stats')
  await page.setControl('起始日期', dateFrom)
  await page.setControl('截止日期', walk.tomorrow)
  await page.clickText('查询', { selector: 'button[type="submit"]' })
  await page.waitForText(`统计区间：${dateFrom} 至 ${walk.tomorrow}`)
  const { token } = await makeHttpTarget().api.login({ username: 'sysadmin', password: DEMO_PASSWORD })
  const url = `${E2E.apiBaseUrl}/api/v1/admin/stats/overview?dateFrom=${dateFrom}&dateTo=${walk.tomorrow}`
  const raw = await (await fetch(url, { headers: { Authorization: `Bearer ${token}` } })).text()
  const stats = JSON.parse(raw) as { utilizationRate: number | null; noShowRate: number | null }
  walk.record('step8-stats-raw', raw)
  const text = await page.text()
  expect(text).toContain(formatRate(stats.utilizationRate))
  expect(text).toContain(formatRate(stats.noShowRate))
  await shot(walk, '10-08d-global-stats')
}

export async function step8SysAdmin(walk: Walk): Promise<void> {
  await loginUi(walk, 'sysadmin', DESKTOP)
  await grantScope(walk)
  await publishNotice(walk)
  await globalStats(walk)
  await visit(walk, '/sys-admin/logs')
  await walk.page.waitForText('改派场地')
  await shot(walk, '10-08e-operation-logs')
}

export async function step9Display(walk: Walk): Promise<void> {
  const { page } = walk
  await page.setViewport(DESKTOP)
  await page.clearLocalStorage(E2E.appUrl)
  await visit(walk, '/display')
  await page.waitForText('本周预约趋势')
  const raw = await (await fetch(`${E2E.apiBaseUrl}/api/v1/display/summary`)).text()
  walk.record('step9-summary-raw', raw)
  const text = await page.text()
  expect(SEED_PEOPLE.filter((word) => text.includes(word)), '大屏上出现了种子用户的用户名或姓名').toEqual([])
  expect(text).toContain(formatRate((JSON.parse(raw) as { todayUtilizationRate: number | null }).todayUtilizationRate))
  await shot(walk, '10-09-display', 'dark')
}
