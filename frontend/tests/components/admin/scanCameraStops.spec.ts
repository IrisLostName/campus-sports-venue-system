// P2-1c 审计 F2（裁决第 8 节第 2 条）：useScanCamera 的三条停止路径各自独立地测——
// (1) 直接卸载（不经路由）；(2) 不卸载组件，只触发路由离开守卫；(3) 页面转入后台（visibilitychange → hidden）。
// 每条用例只走一条路径，去掉该路径的 stop() 时这条用例单独失败。
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter, RouterView } from 'vue-router'

import { useScanCamera, type ScanCamera } from '../../../src/composables/scanCamera'

let tracks: { stop: ReturnType<typeof vi.fn> }[] = []
let camera: ScanCamera | null = null
// 每条用例挂载的组件；afterEach 统一卸载，用例失败时也不会留下监听影响下一条。
let mounted: VueWrapper | null = null

// 只用 useScanCamera 的最小组件；解码相关依赖都是桩，不需要真实摄像头。
const Probe = defineComponent({
  setup() {
    const probe = useScanCamera({
      onCode: () => undefined,
      isSecure: () => true,
      mediaDevices: () => ({ getUserMedia: () => Promise.resolve({ getTracks: () => tracks }) } as unknown as MediaDevices),
      grab: () => null,
      requestFrame: () => 1,
      cancelFrame: () => undefined,
    })
    camera = probe
    return () => h('video', { ref: probe.bindVideo })
  },
})

async function openCamera(): Promise<void> {
  await camera?.start()
  await flushPromises()
  expect(camera?.phase.value).toBe('on')
  expect(tracks[0]?.stop).not.toHaveBeenCalled()
}

beforeEach(() => {
  tracks = [{ stop: vi.fn() }, { stop: vi.fn() }]
  camera = null
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
  Object.defineProperty(HTMLMediaElement.prototype, 'srcObject', {
    configurable: true,
    get(this: { fakeSource?: unknown }) { return this.fakeSource ?? null },
    set(this: { fakeSource?: unknown }, value: unknown) { this.fakeSource = value },
  })
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' })
})

afterEach(() => {
  mounted?.unmount()
  mounted = null
  vi.restoreAllMocks()
})

describe('useScanCamera 的三条停止路径', () => {
  it('（1）开启后直接卸载组件（不经路由）：所有视频轨道被停止', async () => {
    const wrapper = mount(Probe)
    await openCamera()

    wrapper.unmount()
    expect(tracks.every((track) => track.stop.mock.calls.length === 1)).toBe(true)
  })

  it('（2）不卸载组件，只触发路由离开守卫：所有视频轨道被停止，组件仍在', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/scan', component: Probe }, { path: '/elsewhere', component: { render: () => null } }],
    })
    // 全局守卫在组件的离开守卫之后运行：取消导航，组件不会因此卸载，只剩路由离开这一条路径。
    let cancel = false
    router.beforeEach(() => (cancel ? false : true))
    await router.push('/scan')
    const wrapper = mount({ render: () => h(RouterView) }, { global: { plugins: [router] } })
    mounted = wrapper
    await flushPromises()
    await openCamera()

    cancel = true
    await router.push('/elsewhere')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/scan')
    expect(wrapper.findComponent(Probe).exists()).toBe(true)
    expect(tracks.every((track) => track.stop.mock.calls.length === 1)).toBe(true)
    expect(camera?.phase.value).toBe('off')
  })

  it('（3）页面转入后台（visibilitychange，visibilityState = hidden）：所有视频轨道被停止，组件仍在', async () => {
    const wrapper = mount(Probe)
    mounted = wrapper
    await openCamera()

    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'hidden' })
    document.dispatchEvent(new Event('visibilitychange'))
    expect(tracks.every((track) => track.stop.mock.calls.length === 1)).toBe(true)
    expect(camera?.phase.value).toBe('off')
    expect(wrapper.find('video').exists()).toBe(true)
  })

  it('页面仍可见时的 visibilitychange 不停止', async () => {
    mounted = mount(Probe)
    await openCamera()

    document.dispatchEvent(new Event('visibilitychange'))
    expect(tracks[0]?.stop).not.toHaveBeenCalled()
  })
})
