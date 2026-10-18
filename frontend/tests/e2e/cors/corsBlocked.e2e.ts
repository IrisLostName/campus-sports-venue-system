// ACC-M3-11 反证（BE-8 裁决 E3）：后端以不含前端来源的 CORS_ALLOWED_ORIGINS 启动
// （start-e2e-backend.ps1 -AllowedOrigin http://localhost:5173）时，浏览器拦截前端（127.0.0.1:4173）发出的接口请求，
// 页面显示错误而不是数据。
import { appendFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

import { describe, expect, it } from 'vitest'

import { DEMO_PASSWORD } from '../../../src/api/mock/seed'
import { ERROR_MESSAGES } from '../../../src/utils/errorMessages'
import { launchEdge } from '../browser/edgeProcess'
import { MOBILE, PageDriver } from '../browser/pageDriver'
import { announceShotDir, E2E } from '../support/e2eEnv'

const WAIT_MS = 15000

// Edge 会把预检（OPTIONS）也报告为一条请求；这里等的是被拦截的那条 POST。
async function loginRequest(page: PageDriver) {
  const deadline = Date.now() + WAIT_MS
  for (;;) {
    const found = page.requests.find((request) => request.method === 'POST' && request.url.endsWith('/api/v1/auth/login'))
    if (found !== undefined) {
      return found
    }
    if (Date.now() > deadline) {
      throw new Error('没有看到登录请求结束')
    }
    await delay(100)
  }
}

describe('ACC-M3-11 反证：CORS_ALLOWED_ORIGINS 不含前端来源', () => {
  it('浏览器以 CORS 拦截登录请求，页面停留在登录页并显示错误', async () => {
    announceShotDir()
    const edge = await launchEdge(E2E.edgePath, E2E.cdpPort)
    try {
      const page = new PageDriver(edge.page, E2E.shotDir)
      await page.start()
      await page.setViewport(MOBILE)
      await page.clearLocalStorage(E2E.appUrl)
      await page.goto(`${E2E.appUrl}/login`)
      await page.fill('用户名', 'zhangsan')
      await page.fill('密码', DEMO_PASSWORD)
      await page.clickText('登录', { selector: 'button[type="submit"]' })
      const login = await loginRequest(page)
      mkdirSync(E2E.logDir, { recursive: true })
      appendFileSync(join(E2E.logDir, 'cors.jsonl'), `${JSON.stringify({ at: new Date().toISOString(), requests: page.requests })}\n`)
      expect(login.status).toBeNull()
      expect(login.corsError).not.toBeNull()
      await page.waitForText(ERROR_MESSAGES.INTERNAL_ERROR)
      expect(await page.evaluate<string>('location.pathname')).toBe('/login')
      await page.screenshot('11-cors-blocked')
    } finally {
      await edge.close()
    }
  })
})
