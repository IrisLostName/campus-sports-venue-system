// TEST-2 W1 运营大屏（固定深色）：1440×900、1920×1080、1366×768。每张截图前断言没有任何种子用户的用户名或姓名（裁决 P4），
// 并测量：面板两两不重叠、没有滚动条、最小字号 ≥ 12px、没有可交互元素（tourSession.judge）。
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
  for (const [name, viewport] of SIZES) {
    await page.setViewport(viewport)
    await go(tour, '/display')
    await capture(tour, name, {
      surface: 'display', expect: ['运营大屏', '数据更新于', '本周预约趋势', '网球馆'], absent: SEED_PEOPLE,
    })
  }
}
