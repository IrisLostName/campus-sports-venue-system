// P2-1c 裁决第 3 节：管理端“扫码签到”页（真实路由、真实页面、mock 数据）。
// 场馆选择器在该页隐藏（裁决第 6 节第 9 条）；摄像头只在点击后请求权限、离开页面时停止轨道；
// 扫码枪 / 手动输入每次回车都提交，提交后清空并重新聚焦；结果文案与契约 v1.1 错误码一一对应；保留最近 10 条记录。
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DEMO_PASSWORD } from '../../../src/api/mock/seed'
import ScanCodeInput from '../../../src/components/admin/checkin/ScanCodeInput.vue'
import { CAMERA_UNSUPPORTED } from '../../../src/composables/scanCamera'
import { buttonIn, content, openAdminApp } from './support'

vi.mock('../../../src/api/index', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/api/index')>()
  const { swappedApi } = await import('../apiSwap')
  return { ...actual, api: swappedApi() }
})

const WINDOW_OPEN = '2026-10-13T07:50:00'
const FORGED = '00000000-0000-4000-8000-000000000000.1'

let codeOfZhangsan = ''

// 先以 zhangsan 取预约 1（明天 08:00 网球场1）的签到码；at 给出时把时钟拨到该时刻并重新登录管理员。
async function openScan(options: { username?: string; at?: string } = {}) {
  const username = options.username ?? 'admin_tennis'
  const app = await openAdminApp('/venue-admin/check-in', {
    username,
    prepare: async (h) => {
      codeOfZhangsan = (await (await h.clientFor('zhangsan')).getCheckInCode(1)).code
      if (options.at !== undefined) {
        h.clock.set(options.at)
        await h.auth.login({ username, password: DEMO_PASSWORD })
      }
    },
  })
  return app
}

async function submit(root: VueWrapper, code: string): Promise<void> {
  await content(root).get('input[aria-label="签到码"]').setValue(code)
  await content(root).get('form.manual').trigger('submit')
  await flushPromises()
}

function result(root: VueWrapper) {
  return content(root).get('[aria-live="polite"]')
}

interface Track { stop: ReturnType<typeof vi.fn> }

let tracks: Track[] = []
let getUserMedia: ReturnType<typeof vi.fn>

beforeEach(() => {
  tracks = [{ stop: vi.fn() }]
  getUserMedia = vi.fn(() => Promise.resolve({ getTracks: () => tracks }))
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } })
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true })
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
  // 假的媒体流不是真正的 MediaStream：srcObject 只记下赋值。
  Object.defineProperty(HTMLMediaElement.prototype, 'srcObject', {
    configurable: true,
    get(this: { fakeSource?: unknown }) { return this.fakeSource ?? null },
    set(this: { fakeSource?: unknown }, value: unknown) { this.fakeSource = value },
  })
})

afterEach(() => {
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

describe('页面结构', () => {
  it('标题“扫码签到”；该页不显示场馆选择器，回到其他页面时选择器仍在', async () => {
    const { root, router } = await openScan()

    expect(content(root).get('h1').text()).toBe('扫码签到')
    expect(root.find('header select').exists()).toBe(false)
    expect(root.findAll('nav a').find((link) => link.classes().includes('active'))?.text()).toBe('扫码签到')

    await router.push('/venue-admin/reservations?venueId=1')
    await flushPromises()
    expect(root.find('header select').exists()).toBe(true)
  })

  it('初始结果为“等待扫码…”，最近记录为空，摄像头未开启', async () => {
    const { root } = await openScan()

    expect(result(root).text()).toBe('等待扫码…')
    expect(content(root).text()).toContain('暂无记录')
    expect(content(root).text()).toContain('摄像头未开启')
  })
})

describe('摄像头', () => {
  it('进入页面不请求权限；点“开启摄像头”后才请求；离开页面时停止所有轨道', async () => {
    const { root, router } = await openScan()
    expect(getUserMedia).not.toHaveBeenCalled()

    await buttonIn(content(root), '开启摄像头').trigger('click')
    await flushPromises()
    expect(getUserMedia).toHaveBeenCalledTimes(1)
    expect(content(root).find('[data-phase="on"]').exists()).toBe(true)
    expect(buttonIn(content(root), '关闭摄像头').exists()).toBe(true)

    await router.push('/venue-admin/reservations?venueId=1')
    await flushPromises()
    expect(tracks[0]?.stop).toHaveBeenCalledTimes(1)
  })

  it('“关闭摄像头”停止轨道并回到未开启', async () => {
    const { root } = await openScan()
    await buttonIn(content(root), '开启摄像头').trigger('click')
    await flushPromises()
    await buttonIn(content(root), '关闭摄像头').trigger('click')

    expect(tracks[0]?.stop).toHaveBeenCalledTimes(1)
    expect(content(root).find('[data-phase="off"]').exists()).toBe(true)
  })

  it('非安全上下文：说明需要 HTTPS 或 localhost，不请求权限，手动输入仍可用', async () => {
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: false })
    const { root } = await openScan({ at: WINDOW_OPEN })
    await buttonIn(content(root), '开启摄像头').trigger('click')
    await flushPromises()

    expect(getUserMedia).not.toHaveBeenCalled()
    expect(content(root).get('[role="alert"]').text()).toBe(CAMERA_UNSUPPORTED)
    await submit(root, codeOfZhangsan)
    expect(result(root).find('.result-title').text()).toBe('签到成功')
  })

  it('拒绝权限：显示说明', async () => {
    getUserMedia.mockImplementation(() => Promise.reject(Object.assign(new Error('denied'), { name: 'NotAllowedError' })))
    const { root } = await openScan()
    await buttonIn(content(root), '开启摄像头').trigger('click')
    await flushPromises()

    expect(content(root).get('[role="alert"]').text()).toContain('摄像头权限被拒绝')
  })
})

describe('扫码枪 / 手动输入与结果', () => {
  it('窗口内提交：签到成功，显示预约人、场地、时段、签到时刻；输入框清空并保持聚焦', async () => {
    const { root } = await openScan({ at: WINDOW_OPEN })
    await submit(root, `  ${codeOfZhangsan}  `)

    expect(result(root).find('.result-title').text()).toBe('签到成功')
    expect(result(root).findAll('dd').map((node) => node.text())).toEqual([
      '张三（zhangsan）', '网球馆 · 网球场1', '2026-10-13 周二 08:00–09:30', '07:50',
    ])
    expect((content(root).get('input[aria-label="签到码"]').element as HTMLInputElement).value).toBe('')
  })

  it('输入框：进入页面即聚焦；回车提交后清空并重新聚焦（扫码枪连续使用）', async () => {
    const field = mount(ScanCodeInput, { props: { busy: false }, attachTo: document.body })
    const input = field.get('input')
    expect(document.activeElement).toBe(input.element)

    await input.setValue('abc')
    await field.get('form').trigger('submit')
    expect(field.emitted('submit')).toEqual([['abc']])
    expect((input.element as HTMLInputElement).value).toBe('')
    expect(document.activeElement).toBe(input.element)
    field.unmount()
  })

  it('同一个码再次回车也会提交（不去重）：第二次为“已签到”', async () => {
    const { root } = await openScan({ at: WINDOW_OPEN })
    await submit(root, codeOfZhangsan)
    await submit(root, codeOfZhangsan)

    expect(result(root).find('.result-title').text()).toBe('已签到')
    expect(content(root).findAll('ol.history li')).toHaveLength(2)
  })

})

describe('结果文案与最近记录', () => {
  it.each([
    ['伪造的码', FORGED, '签到码无效', '这个码与任何预约都对不上。'],
    ['格式不对', 'hello', '签到码格式不正确', '请对准用户手机上的二维码重新扫描，或检查输入的内容。'],
  ])('%s → %s', async (_title, code, heading, detail) => {
    const { root } = await openScan({ at: WINDOW_OPEN })
    await submit(root, code)

    expect(result(root).find('.result-title').text()).toBe(heading)
    expect(result(root).text()).toContain(detail)
    expect(result(root).classes()).toContain('err')
  })

  it('不在签到时间内：显示开放时间', async () => {
    const { root } = await openScan()
    await submit(root, codeOfZhangsan)

    expect(result(root).find('.result-title').text()).toBe('当前不在签到时间内')
    expect(result(root).text()).toContain('该预约的签到时间为 2026-10-13 07:45–08:15。')
  })

  it('场馆管理员越出授权范围：说明不在授权范围', async () => {
    const { root } = await openScan({ username: 'admin_pool', at: WINDOW_OPEN })
    await submit(root, codeOfZhangsan)

    expect(result(root).find('.result-title').text()).toBe('无权操作该场馆')
    expect(result(root).text()).toContain('该预约所属场馆不在你的授权范围内。')
  })

  it('空白输入不提交', async () => {
    const { root } = await openScan()
    await submit(root, '   ')

    expect(result(root).text()).toBe('等待扫码…')
  })

  it('最近记录新的在前，至多 10 条', async () => {
    const { root } = await openScan({ at: WINDOW_OPEN })
    for (let index = 0; index < 11; index += 1) {
      await submit(root, FORGED)
    }
    await submit(root, codeOfZhangsan)

    const rows = content(root).findAll('ol.history li')
    expect(rows).toHaveLength(10)
    expect(rows[0]?.attributes('data-ok')).toBe('true')
    expect(rows[0]?.text()).toContain('签到成功')
    expect(rows[1]?.text()).toContain('签到码无效')
  })
})
