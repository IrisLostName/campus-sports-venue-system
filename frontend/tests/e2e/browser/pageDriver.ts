// 页面驱动（BE-8 W2）：真实的鼠标、键盘输入（Input.*）与截图（Page.captureScreenshot），并记录接口请求的耗时与失败（K3、E3）。
// 截图前由调用方先断言页面文字，保证不会把错误的状态拍成证据。
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

import type { CdpParams, CdpSession } from './cdpSession'
import { findByText, focusField, setControl, type FindArgs, type Point } from './pageScripts'

export interface Viewport {
  width: number
  height: number
  mobile: boolean
}

export const MOBILE: Viewport = { width: 375, height: 812, mobile: true }
export const IPHONE16: Viewport = { width: 393, height: 852, mobile: true }
export const DESKTOP: Viewport = { width: 1440, height: 900, mobile: false }

export interface ApiRequestLog {
  method: string
  url: string
  status: number | null
  allowOrigin: string | null       // 响应头 Access-Control-Allow-Origin（E3 正证）
  durationMs: number | null
  failure: string | null
  corsError: string | null
}

export interface ClickOptions {
  exact?: boolean
  nth?: number
  within?: string
  selector?: string
}

export const CANCELED = 'canceled'      // 页面自己取消的请求（例如轮询被替换），不算失败
export const ABANDONED = 'abandoned'    // 整页跳转时旧文档里尚未结束的请求
const WAIT_MS = 15000
const POLL_MS = 100
const SETTLE_MS = 450
const CLICKABLE = 'button, a, [role="button"], [role="tab"], [role="option"], [role="radio"], [role="switch"], label, summary'

interface Started {
  method: string; url: string; loaderId: string; start: number; status: number | null; allowOrigin: string | null
}

export class PageDriver {
  readonly requests: ApiRequestLog[] = []
  private readonly inFlight = new Map<string, Started>()
  private viewport: Viewport = DESKTOP

  constructor(private readonly cdp: CdpSession, private readonly shotDir: string) {}

  async start(): Promise<void> {
    await this.cdp.send('Page.enable')
    await this.cdp.send('Runtime.enable')
    await this.cdp.send('Network.enable')
    await this.cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] })
    this.trackRequests()
  }

  // TEST-2：真实的 prefers-color-scheme 模拟（BE-8 的截图只按浅色拍摄，主题只体现在文件名里）。
  async setTheme(theme: 'light' | 'dark'): Promise<void> {
    await this.cdp.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: theme }] })
  }

  // TEST-2 K2：给每个请求加固定延迟，让“提交进行中”可以被观察；null 取消限速。
  async throttle(latencyMs: number | null): Promise<void> {
    await this.cdp.send('Network.emulateNetworkConditions', {
      offline: false, latency: latencyMs ?? 0, downloadThroughput: -1, uploadThroughput: -1,
    })
  }

  // TEST-2 K2：浏览器“后退”（历史记录上一项），不等待任何事件。
  async historyBack(): Promise<void> {
    const history = await this.cdp.send<{ currentIndex: number; entries: { id: number }[] }>('Page.getNavigationHistory')
    const previous = history.entries[history.currentIndex - 1]
    if (previous === undefined) {
      throw new Error('没有可以后退的历史记录')
    }
    await this.cdp.send('Page.navigateToHistoryEntry', { entryId: previous.id })
  }

  async setViewport(viewport: Viewport): Promise<void> {
    this.viewport = viewport
    await this.cdp.send('Emulation.setDeviceMetricsOverride', {
      width: viewport.width, height: viewport.height, deviceScaleFactor: viewport.mobile ? 2 : 1, mobile: viewport.mobile,
    })
  }

  // 整页跳转会中断进行中的请求且不再有结束事件，所以先等当前页面的接口请求全部结束（也借此发现挂起的请求，K3）。
  async goto(url: string): Promise<void> {
    await this.waitIdle()
    const loaded = this.nextEvent('Page.loadEventFired')
    await this.cdp.send('Page.navigate', { url })
    await loaded
  }

  // 测试脚手架：清空某个来源的 localStorage（切换演示账号用），不需要先打开页面，因而不会中断页面的请求。
  async clearLocalStorage(origin: string): Promise<void> {
    await this.cdp.send('Storage.clearDataForOrigin', { origin, storageTypes: 'local_storage' })
  }

  async evaluate<T>(expression: string): Promise<T> {
    const reply = await this.cdp.send<{ result: { value?: unknown }; exceptionDetails?: { text: string } }>(
      'Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (reply.exceptionDetails) {
      throw new Error(`页面脚本出错：${reply.exceptionDetails.text}`)
    }
    return reply.result.value as T
  }

  text(): Promise<string> {
    return this.evaluate<string>('document.body ? document.body.innerText : ""')
  }

  async waitFor(expression: string, label: string, timeoutMs = WAIT_MS): Promise<void> {
    const deadline = Date.now() + timeoutMs
    while (!(await this.evaluate<boolean>(`Boolean(${expression})`))) {
      if (Date.now() > deadline) {
        throw new Error(`等待超时（${timeoutMs} ms）：${label}`)
      }
      await delay(POLL_MS)
    }
  }

  async waitForText(text: string, timeoutMs = WAIT_MS): Promise<void> {
    await this.waitFor(`document.body && document.body.innerText.includes(${JSON.stringify(text)})`, `页面出现「${text}」`, timeoutMs)
  }

  async waitForGone(text: string, timeoutMs = WAIT_MS): Promise<void> {
    await this.waitFor(`document.body && !document.body.innerText.includes(${JSON.stringify(text)})`, `页面不再有「${text}」`, timeoutMs)
  }

  async clickText(text: string, options: ClickOptions = {}): Promise<void> {
    const args: FindArgs = {
      text, selector: options.selector ?? CLICKABLE, exact: options.exact ?? true, nth: options.nth ?? 0, within: options.within ?? null,
    }
    const point = await this.retry(() => this.evaluate<Point | null>(`(${findByText.toString()})(${JSON.stringify(args)})`), `可点击的「${text}」`)
    await this.click(point)
  }

  // 按 CSS 选择器点击第 nth 个可见元素（例如日期条的 [data-date="…"]）。
  async clickCss(selector: string, nth = 0): Promise<void> {
    const args: FindArgs = { text: '', selector, exact: false, nth, within: null }
    const point = await this.retry(() => this.evaluate<Point | null>(`(${findByText.toString()})(${JSON.stringify(args)})`), `元素 ${selector}`)
    await this.click(point)
  }

  async fill(label: string, value: string, nth = 0): Promise<void> {
    const args = JSON.stringify({ label, nth })
    await this.retry(() => this.evaluate<Point | null>(`(${focusField.toString()})(${args})`), `输入框「${label}」`)
    await this.cdp.send('Input.insertText', { text: value })
  }

  // 原生下拉框、日期与时间输入框（见 pageScripts.setControl 的说明）。
  async setControl(label: string, value: string, within: string | null = null): Promise<void> {
    const args = JSON.stringify({ label, value, within })
    await this.retry(async () => (await this.evaluate<boolean>(`(${setControl.toString()})(${args})`)) || null, `控件「${label}」= ${value}`)
  }

  async press(key: 'Enter' | 'Escape' | 'Tab'): Promise<void> {
    const codes = { Enter: 13, Escape: 27, Tab: 9 }
    for (const type of ['keyDown', 'keyUp']) {
      await this.cdp.send('Input.dispatchKeyEvent', { type, key, code: key, windowsVirtualKeyCode: codes[key] })
    }
  }

  async scrollTo(selector: string): Promise<void> {
    await this.waitFor(`document.querySelector(${JSON.stringify(selector)})`, `元素 ${selector}`)
    await this.evaluate(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({ block: 'center' })`)
  }

  // 等接口请求全部结束、过渡动画走完后截图；返回文件名。
  // theme 只影响文件名：大屏固定为深色（FE-7），其余页面按浅色拍摄；要真的切换深色先调用 setTheme。
  // prefix 缺省为 BE-8 的 ACC-M3-，TEST-2 传 ACC-M4-02-。
  async screenshot(name: string, theme: 'light' | 'dark' = 'light', prefix = 'ACC-M3-'): Promise<string> {
    await this.waitIdle()
    await delay(SETTLE_MS)
    const { data } = await this.cdp.send<{ data: string }>('Page.captureScreenshot', { format: 'png' })
    const file = `${prefix}${name}-${this.viewport.width}x${this.viewport.height}-${theme}.png`
    mkdirSync(this.shotDir, { recursive: true })
    writeFileSync(join(this.shotDir, file), Buffer.from(data, 'base64'))
    return file
  }

  async waitIdle(timeoutMs = WAIT_MS): Promise<void> {
    const deadline = Date.now() + timeoutMs
    while (this.inFlight.size > 0) {
      if (Date.now() > deadline) {
        throw new Error(`接口请求超过 ${timeoutMs} ms 仍未结束：${[...this.inFlight.values()].map((r) => r.url).join(', ')}`)
      }
      await delay(POLL_MS)
    }
  }

  private nextEvent(method: string, timeoutMs = WAIT_MS): Promise<CdpParams> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        off()
        reject(new Error(`等待 ${method} 超时（${timeoutMs} ms）`))
      }, timeoutMs)
      const off = this.cdp.on(method, (params) => {
        clearTimeout(timer)
        off()
        resolve(params)
      })
    })
  }

  private async click(point: Point): Promise<void> {
    const base = { x: point.x, y: point.y, button: 'left', clickCount: 1 }
    await this.cdp.send('Input.dispatchMouseEvent', { ...base, type: 'mouseMoved', button: 'none' })
    await this.cdp.send('Input.dispatchMouseEvent', { ...base, type: 'mousePressed' })
    await this.cdp.send('Input.dispatchMouseEvent', { ...base, type: 'mouseReleased' })
  }

  private async retry<T>(attempt: () => Promise<T | null>, label: string): Promise<T> {
    const deadline = Date.now() + WAIT_MS
    for (;;) {
      const found = await attempt()
      if (found !== null) {
        return found
      }
      if (Date.now() > deadline) {
        throw new Error(`找不到${label}`)
      }
      await delay(POLL_MS)
    }
  }

  private trackRequests(): void {
    const isApi = (params: CdpParams) => String((params.request as { url?: string } | undefined)?.url ?? '').includes('/api/v1/')
    this.cdp.on('Network.requestWillBeSent', (params) => {
      if (isApi(params) && params.type !== 'Preflight') {
        const request = params.request as { method: string; url: string }
        this.inFlight.set(String(params.requestId), {
          method: request.method, url: request.url, loaderId: String(params.loaderId),
          start: Number(params.timestamp), status: null, allowOrigin: null,
        })
      }
    })
    // 主框架换了文档：旧文档里没结束的请求不会再有结束事件，记为 abandoned（K3 单独统计）。
    this.cdp.on('Page.frameNavigated', (params) => {
      const frame = params.frame as { parentId?: string; loaderId: string }
      if (frame.parentId === undefined) {
        for (const [requestId, started] of this.inFlight) {
          if (started.loaderId !== frame.loaderId) {
            this.finish({ requestId, timestamp: started.start }, ABANDONED, null)
          }
        }
      }
    })
    this.cdp.on('Network.responseReceived', (params) => {
      const started = this.inFlight.get(String(params.requestId))
      if (started) {
        const response = params.response as { status: number; headers: Record<string, string> }
        started.status = Number(response.status)
        const header = Object.entries(response.headers).find(([name]) => name.toLowerCase() === 'access-control-allow-origin')
        started.allowOrigin = header?.[1] ?? null
      }
    })
    this.cdp.on('Network.loadingFinished', (params) => this.finish(params, null, null))
    this.cdp.on('Network.loadingFailed', (params) => this.finish(params, params.canceled === true ? CANCELED : String(params.errorText ?? ''),
      params.corsErrorStatus === undefined ? null : JSON.stringify(params.corsErrorStatus)))
  }

  private finish(params: CdpParams, failure: string | null, corsError: string | null): void {
    const started = this.inFlight.get(String(params.requestId))
    if (!started) {
      return
    }
    this.inFlight.delete(String(params.requestId))
    const durationMs = Math.round((Number(params.timestamp) - started.start) * 1000)
    this.requests.push({
      method: started.method, url: started.url, status: started.status, allowOrigin: started.allowOrigin, durationMs, failure, corsError,
    })
  }
}
