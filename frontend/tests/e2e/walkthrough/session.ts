// 演示主线走查（ACC-M3-10）共用的上下文：无头 Edge、页面驱动、服务端日期与接口要点记录。
// 接口要点逐行写入日志目录下的 walkthrough.jsonl，供 docs/evidence/ACC-M3-10.md 引用；不读写数据库（K7）。
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { DEMO_PASSWORD } from '../../../src/api/mock/seed'
import { addDays, dateOf } from '../../../src/api/mock/timeMath'
import { launchEdge, type EdgeHandle } from '../browser/edgeProcess'
import { PageDriver, type Viewport } from '../browser/pageDriver'
import { announceShotDir, E2E } from '../support/e2eEnv'
import { makeHttpTarget } from '../support/httpTarget'

export interface Walk {
  page: PageDriver
  edge: EdgeHandle
  today: string
  tomorrow: string
  shots: string[]
  record(label: string, data: unknown): void
}

const LOG_FILE = 'walkthrough.jsonl'

export async function openWalk(): Promise<Walk> {
  const summary = await makeHttpTarget().api.getDisplaySummary()
  const today = dateOf(summary.generatedAt)
  mkdirSync(E2E.logDir, { recursive: true })
  writeFileSync(join(E2E.logDir, LOG_FILE), '')
  announceShotDir()
  const edge = await launchEdge(E2E.edgePath, E2E.cdpPort)
  const page = new PageDriver(edge.page, E2E.shotDir)
  await page.start()
  return {
    page, edge, today, tomorrow: addDays(today, 1), shots: [],
    record(label, data) {
      appendFileSync(join(E2E.logDir, LOG_FILE), `${JSON.stringify({ at: new Date().toISOString(), label, data })}\n`)
    },
  }
}

export async function closeWalk(walk: Walk | undefined): Promise<void> {
  if (walk) {
    walk.record('requests', walk.page.requests)
    walk.record('shots', walk.shots)
    await walk.edge.close()
  }
}

export async function visit(walk: Walk, path: string): Promise<void> {
  await walk.page.goto(`${E2E.appUrl}${path}`)
}

export async function shot(walk: Walk, name: string, theme: 'light' | 'dark' = 'light'): Promise<void> {
  walk.shots.push(await walk.page.screenshot(name, theme))
}

// 经登录页登录。先清掉上一位用户的会话（测试脚手架清空本源的 localStorage，不是应用行为）。
export async function loginUi(walk: Walk, username: string, viewport: Viewport, loginShot?: string): Promise<void> {
  const { page } = walk
  await page.setViewport(viewport)
  await page.clearLocalStorage(E2E.appUrl)
  await visit(walk, '/login')
  await page.waitForText('用户名')
  await page.fill('用户名', username)
  await page.fill('密码', DEMO_PASSWORD)
  if (loginShot !== undefined) {
    await shot(walk, loginShot)
  }
  await page.clickText('登录', { selector: 'button[type="submit"]' })
  await page.waitFor('location.pathname !== "/login"', `${username} 登录后离开登录页`)
}

// 用户端：从订场页选场馆与日期（明天），等到该场馆的时段表出现。
export async function openVenueSlots(walk: Walk, venueName: string, firstResource: string): Promise<void> {
  const { page } = walk
  await page.clickText(venueName, { selector: 'button', exact: false })
  await page.clickCss(`[data-date="${walk.tomorrow}"]`)
  await page.waitFor(`document.querySelector('section[aria-label="${firstResource}"] button')`, `${firstResource} 的时段出现`)
}

export async function pickSlot(walk: Walk, resourceName: string, startTime: string): Promise<void> {
  await walk.page.clickText(`${startTime}–`, { within: `section[aria-label="${resourceName}"]`, selector: 'button', exact: false })
}
