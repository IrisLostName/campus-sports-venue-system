// TEST-2 W1 运营大屏（默认浅色、可切换深色，UI-2a）：1440×900、1920×1080、1366×768，每种尺寸拍浅色与深色。
// 每张截图前断言没有任何种子用户的用户名或姓名（裁决 P4），并测量：面板两两不重叠、没有滚动条、最小字号 ≥ 12px、
// 只有主题与全屏两个按钮（tourSession.judge）；走完后核对这期间只请求过 GET /display/summary（不调用写接口）。
import { expect } from 'vitest'

import { DESKTOP, type Viewport } from '../browser/pageDriver'
import { E2E } from '../support/e2eEnv'
import { SEED_PEOPLE } from '../walkthrough/sysSteps'
import { capture, go, type Tour } from './tourSession'

const SIZES: [string, Viewport][] = [
  ['38-display', DESKTOP],
  ['39-display', { width: 1920, height: 1080, mobile: false }],
  ['40-display', { width: 1366, height: 768, mobile: false }],
]

export async function displayPages(tour: Tour): Promise<void> {
  const { page } = tour
  await page.clearLocalStorage(E2E.appUrl)
  const firstRequest = page.requests.length
  for (const [name, viewport] of SIZES) {
    await page.setViewport(viewport)
    await go(tour, '/display')
    await capture(tour, name, {
      surface: 'display', expect: ['运营大屏', '数据更新于', '本周预约趋势', '网球馆'], absent: SEED_PEOPLE,
    })
  }
  const requests = page.requests.slice(firstRequest).map((request) => `${request.method} ${new URL(request.url).pathname}`)
  expect(requests.length).toBeGreaterThan(0)
  // OPTIONS 是浏览器的跨域预检（BE-8），不是页面发起的调用。
  expect(requests.filter((request) => !/^(GET|OPTIONS) \S*\/display\/summary$/.test(request)), '大屏期间出现其他接口调用').toEqual([])
}
