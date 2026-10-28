// P2-1c 裁决第 3 节：扫码页摄像头——点击后才请求权限、停止所有轨道、请求迟到时立即停止、逐帧解码节流 ≥ 200 ms、
// 同一个码 3 秒内不重复提交（以最近一次看到它计时）、不支持或被拒绝时的说明。依赖全部注入，不需要真实摄像头。
import { describe, expect, it, vi } from 'vitest'

import {
  CAMERA_DENIED, CAMERA_FAILED, CAMERA_NOT_FOUND, CAMERA_UNSUPPORTED, cameraErrorText, createDeduper, createScanCamera,
  DECODE_INTERVAL_MS, DEDUPE_MS, type ScanCameraDeps,
} from '../../../src/composables/scanCamera'
import type { RgbaFrame } from '../../../src/utils/qrDecode'

interface FakeTrack { stop: ReturnType<typeof vi.fn> }

function fakeStream(): { stream: MediaStream; tracks: FakeTrack[] } {
  const tracks = [{ stop: vi.fn() }, { stop: vi.fn() }]
  return { stream: { getTracks: () => tracks } as unknown as MediaStream, tracks }
}

function fakeVideo(): HTMLVideoElement {
  const video = document.createElement('video')
  let source: MediaProvider | null = null
  Object.defineProperty(video, 'srcObject', { get: () => source, set: (value: MediaProvider | null) => { source = value } })
  video.play = vi.fn(() => Promise.resolve())
  return video
}

const FRAME: RgbaFrame = { data: new Uint8ClampedArray(4), width: 1, height: 1 }

// 手动驱动的动画帧：run(time) 执行当前排队的回调。
function frames() {
  let queued: ((time: number) => void) | null = null
  let cancelled = 0
  return {
    requestFrame: (callback: (time: number) => void) => { queued = callback; return 1 },
    cancelFrame: () => { queued = null; cancelled += 1 },
    async run(time: number) {
      const callback = queued
      queued = null
      callback?.(time)
      await Promise.resolve()
      await Promise.resolve()
    },
    get cancelled() { return cancelled },
  }
}

function setup(overrides: Partial<ScanCameraDeps> = {}) {
  const { stream, tracks } = fakeStream()
  const getUserMedia = vi.fn(() => Promise.resolve(stream))
  const onCode = vi.fn()
  const frame = frames()
  let clock = 0
  const camera = createScanCamera({
    onCode,
    mediaDevices: () => ({ getUserMedia } as unknown as MediaDevices),
    isSecure: () => true,
    grab: () => FRAME,
    decode: () => Promise.resolve('CODE-A'),
    now: () => clock,
    requestFrame: frame.requestFrame,
    cancelFrame: frame.cancelFrame,
    ...overrides,
  })
  const video = fakeVideo()
  camera.bindVideo(video)
  return { camera, getUserMedia, onCode, tracks, frame, video, setClock: (value: number) => { clock = value } }
}

describe('权限与生命周期', () => {
  it('创建后不请求摄像头权限；点击（start）后才以后置摄像头、无音频请求', async () => {
    const { camera, getUserMedia } = setup()
    expect(getUserMedia).not.toHaveBeenCalled()
    expect(camera.phase.value).toBe('off')

    await camera.start()
    expect(getUserMedia).toHaveBeenCalledWith({ video: { facingMode: 'environment' }, audio: false })
    expect(camera.phase.value).toBe('on')
  })

  it('关闭时停止所有视频轨道、停止解码循环、清空画面', async () => {
    const { camera, tracks, frame, video } = setup()
    await camera.start()
    camera.stop()

    expect(tracks.every((track) => track.stop.mock.calls.length === 1)).toBe(true)
    expect(frame.cancelled).toBe(1)
    expect(video.srcObject).toBeNull()
    expect(camera.phase.value).toBe('off')
  })

  it('权限请求在关闭（或离开页面）之后才返回：立即停止返回的轨道，不进入开启状态', async () => {
    const { stream, tracks } = fakeStream()
    let resolve: (value: MediaStream) => void = () => undefined
    const getUserMedia = vi.fn(() => new Promise<MediaStream>((done) => { resolve = done }))
    const { camera } = setup({ mediaDevices: () => ({ getUserMedia } as unknown as MediaDevices) })

    const starting = camera.start()
    expect(camera.phase.value).toBe('starting')
    camera.stop()
    resolve(stream)
    await starting

    expect(tracks.every((track) => track.stop.mock.calls.length === 1)).toBe(true)
    expect(camera.phase.value).toBe('off')
  })

  it('非安全上下文或没有 mediaDevices：说明“需要 HTTPS 或 localhost”，不请求权限', async () => {
    const insecure = setup({ isSecure: () => false })
    await insecure.camera.start()
    expect([insecure.camera.phase.value, insecure.camera.error.value]).toEqual(['error', CAMERA_UNSUPPORTED])
    expect(insecure.getUserMedia).not.toHaveBeenCalled()

    const missing = setup({ mediaDevices: () => ({} as MediaDevices) })
    await missing.camera.start()
    expect(missing.camera.error.value).toBe(CAMERA_UNSUPPORTED)
  })

  it('拒绝权限、找不到摄像头、其他错误各有说明；出错后可以再次开启', async () => {
    let failure: unknown = Object.assign(new Error('x'), { name: 'NotAllowedError' })
    const { stream } = fakeStream()
    const getUserMedia = vi.fn(() => (failure === null ? Promise.resolve(stream) : Promise.reject(failure)))
    const { camera } = setup({ mediaDevices: () => ({ getUserMedia } as unknown as MediaDevices) })

    await camera.start()
    expect([camera.phase.value, camera.error.value]).toEqual(['error', CAMERA_DENIED])
    failure = null
    await camera.start()
    expect([camera.phase.value, camera.error.value]).toEqual(['on', null])

    expect(cameraErrorText({ name: 'NotFoundError' })).toBe(CAMERA_NOT_FOUND)
    expect(cameraErrorText({ name: 'OverconstrainedError' })).toBe(CAMERA_NOT_FOUND)
    expect(cameraErrorText(new Error('boom'))).toBe(CAMERA_FAILED)
  })
})

describe('逐帧解码：节流与暂停', () => {
  it(`两次解码间隔不少于 ${DECODE_INTERVAL_MS} ms`, async () => {
    const decode = vi.fn(() => Promise.resolve(null))
    const { camera, frame } = setup({ decode })
    await camera.start()

    for (const time of [1000, 1050, 1150, 1199, 1200, 1300, 1400]) {
      await frame.run(time)
    }
    expect(decode).toHaveBeenCalledTimes(3)   // 1000、1200、1400
  })

  it('提交进行中（isPaused）不解码', async () => {
    let paused = true
    const decode = vi.fn(() => Promise.resolve(null))
    const { camera, frame } = setup({ decode, isPaused: () => paused })
    await camera.start()
    await frame.run(1000)
    expect(decode).not.toHaveBeenCalled()
    paused = false
    await frame.run(1300)
    expect(decode).toHaveBeenCalledTimes(1)
  })
})

describe(`同一个码 ${DEDUPE_MS / 1000} 秒内不重复提交`, () => {
  it('码一直对着镜头不重复提交；移开 3 秒后再对准才再提交；不同的码立即提交', async () => {
    let seen: string | null = 'CODE-A'
    const { camera, frame, onCode, setClock } = setup({ decode: () => Promise.resolve(seen) })
    await camera.start()

    const look = async (time: number, code: string | null) => {
      seen = code
      setClock(time)
      await frame.run(time)
    }
    await look(0, 'CODE-A')
    await look(1000, 'CODE-A')
    await look(2500, 'CODE-A')
    await look(5000, 'CODE-A')        // 一直对着：距上次看到只有 2.5 秒
    await look(5300, 'CODE-B')        // 不同的码
    await look(9000, 'CODE-A')        // 换回 CODE-A（上一个提交的是 CODE-B）
    await look(9300, null)

    expect(onCode.mock.calls).toEqual([['CODE-A'], ['CODE-B'], ['CODE-A']])
  })

  it('createDeduper：同码以最近一次看到计时，恰好 3 秒时再提交', () => {
    const fresh = createDeduper()
    expect([fresh('A', 0), fresh('A', 2999), fresh('A', 5999), fresh('A', 7000), fresh('A', 10000), fresh('B', 10001)])
      .toEqual([true, false, true, false, true, true])
  })
})
