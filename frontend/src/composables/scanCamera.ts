// 扫码页的摄像头（P2-1c 裁决第 3 节）：
// - 只在点“开启摄像头”后才请求权限（start），进入页面时不请求；
// - 关闭、离开页面（卸载或路由离开）、页面转入后台时停止所有视频轨道；请求在关闭或卸载之后才返回时立即停止；
// - 逐帧解码节流（两次解码间隔 ≥ DECODE_INTERVAL_MS），提交进行中暂停解码；
// - 同一个码在 DEDUPE_MS 内不重复提交：以“最近一次看到它”计时，码一直对着镜头时不会每 3 秒重复提交，移开 3 秒后再对准才再提交；
//   去重只在摄像头路径，扫码枪与手动输入每次回车都提交（P2-1c 裁决第 6 节第 5 条）；
// - 不支持摄像头（非安全上下文或没有 mediaDevices）或被拒绝时给出说明，手动输入仍可用。
// 依赖可注入，测试不需要真实摄像头与画布。
import { onBeforeUnmount, ref } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'

import { decodeQr, type RgbaFrame } from '../utils/qrDecode'

export const DECODE_INTERVAL_MS = 200
export const DEDUPE_MS = 3000
const MAX_FRAME_WIDTH = 480

export type CameraPhase = 'off' | 'starting' | 'on' | 'error'

export interface ScanCameraDeps {
  onCode(code: string): void
  isPaused?: () => boolean
  mediaDevices?: () => MediaDevices | undefined
  isSecure?: () => boolean
  decode?: (frame: RgbaFrame) => Promise<string | null>
  grab?: (video: HTMLVideoElement) => RgbaFrame | null
  now?: () => number
  requestFrame?: (callback: (time: number) => void) => number
  cancelFrame?: (handle: number) => void
}

export const CAMERA_UNSUPPORTED = '当前环境不支持摄像头（需要 HTTPS 或 localhost）。请使用扫码枪或手动输入签到码。'
export const CAMERA_DENIED = '摄像头权限被拒绝。请在浏览器地址栏的权限设置中允许使用摄像头后重试，或使用扫码枪 / 手动输入。'
export const CAMERA_NOT_FOUND = '未找到可用的摄像头。请使用扫码枪或手动输入签到码。'
export const CAMERA_FAILED = '摄像头无法开启。请重试，或使用扫码枪 / 手动输入。'

const ERROR_TEXT_BY_NAME: Record<string, string> = {
  NotAllowedError: CAMERA_DENIED,
  SecurityError: CAMERA_DENIED,
  NotFoundError: CAMERA_NOT_FOUND,
  OverconstrainedError: CAMERA_NOT_FOUND,
  DevicesNotFoundError: CAMERA_NOT_FOUND,
}

export function cameraErrorText(error: unknown): string {
  const name = typeof error === 'object' && error !== null && 'name' in error ? String((error as { name: unknown }).name) : ''
  return ERROR_TEXT_BY_NAME[name] ?? CAMERA_FAILED
}

// 把当前画面缩到不超过 480 像素宽后取像素。
function grabFrame(video: HTMLVideoElement, canvas: HTMLCanvasElement): RgbaFrame | null {
  if (video.readyState < 2 || video.videoWidth === 0) {
    return null
  }
  const scale = Math.min(1, MAX_FRAME_WIDTH / video.videoWidth)
  const width = Math.round(video.videoWidth * scale)
  const height = Math.round(video.videoHeight * scale)
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (context === null) {
    return null
  }
  context.drawImage(video, 0, 0, width, height)
  return { data: context.getImageData(0, 0, width, height).data, width, height }
}

function defaultGrab(): (video: HTMLVideoElement) => RgbaFrame | null {
  let canvas: HTMLCanvasElement | null = null
  return (video) => {
    canvas ??= document.createElement('canvas')
    return grabFrame(video, canvas)
  }
}

// 同一个码的去重：最近一次看到它不足 DEDUPE_MS 时不提交。
export function createDeduper(windowMs = DEDUPE_MS) {
  let lastCode: string | null = null
  let lastSeen = -Infinity
  return (code: string, now: number): boolean => {
    const fresh = code !== lastCode || now - lastSeen >= windowMs
    lastCode = code
    lastSeen = now
    return fresh
  }
}

function devicesOf(deps: ScanCameraDeps): MediaDevices | null {
  const secure = deps.isSecure?.() ?? window.isSecureContext
  const devices = deps.mediaDevices?.() ?? navigator.mediaDevices
  return secure && devices !== undefined && typeof devices.getUserMedia === 'function' ? devices : null
}

function stopTracks(target: MediaStream | null): void {
  target?.getTracks().forEach((track) => track.stop())
}

// 逐帧解码循环：节流、暂停、去重；返回停止函数。
function createDecodeLoop(deps: ScanCameraDeps, video: HTMLVideoElement, isLive: () => boolean): () => void {
  const requestFrame = deps.requestFrame ?? ((callback) => requestAnimationFrame(callback))
  const cancelFrame = deps.cancelFrame ?? ((handle) => cancelAnimationFrame(handle))
  const decode = deps.decode ?? decodeQr
  const grab = deps.grab ?? defaultGrab()
  const now = deps.now ?? (() => performance.now())
  const fresh = createDeduper()
  let lastDecode = -Infinity
  let decoding = false
  let handle = 0

  async function tick(time: number): Promise<void> {
    handle = requestFrame((next) => void tick(next))
    if (decoding || deps.isPaused?.() === true || time - lastDecode < DECODE_INTERVAL_MS) {
      return
    }
    lastDecode = time
    const frame = grab(video)
    if (frame === null) {
      return
    }
    decoding = true
    try {
      const code = await decode(frame)
      if (code !== null && isLive() && fresh(code, now())) {
        deps.onCode(code)
      }
    } finally {
      decoding = false
    }
  }

  handle = requestFrame((time) => void tick(time))
  return () => cancelFrame(handle)
}

export function createScanCamera(deps: ScanCameraDeps) {
  const video = ref<HTMLVideoElement | null>(null)
  const phase = ref<CameraPhase>('off')
  const error = ref<string | null>(null)
  let stream: MediaStream | null = null
  let stopLoop: (() => void) | null = null
  let generation = 0          // 每次 start / stop 加一；请求返回时代数已变则作废

  function stop(): void {
    generation += 1
    stopLoop?.()
    stopLoop = null
    stopTracks(stream)
    stream = null
    if (video.value !== null) {
      video.value.srcObject = null
    }
    if (phase.value !== 'error') {
      phase.value = 'off'
    }
  }

  async function open(devices: MediaDevices, target: HTMLVideoElement, mine: number): Promise<void> {
    const opened = await devices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
    if (mine !== generation) {
      stopTracks(opened)
      return
    }
    stream = opened
    target.srcObject = opened
    await target.play().catch(() => undefined)
    if (mine === generation) {
      phase.value = 'on'
      stopLoop = createDecodeLoop(deps, target, () => phase.value === 'on')
    }
  }

  async function start(): Promise<void> {
    const target = video.value
    if (target === null || phase.value === 'starting' || phase.value === 'on') {
      return
    }
    const devices = devicesOf(deps)
    if (devices === null) {
      phase.value = 'error'
      error.value = CAMERA_UNSUPPORTED
      return
    }
    generation += 1
    const mine = generation
    phase.value = 'starting'
    error.value = null
    try {
      await open(devices, target, mine)
    } catch (failure) {
      if (mine === generation) {
        phase.value = 'error'
        error.value = cameraErrorText(failure)
      }
    }
  }

  // 模板里用函数 ref 绑定 <video>（:ref="bindVideo"）。
  function bindVideo(element: unknown): void {
    video.value = element instanceof HTMLVideoElement ? element : null
  }

  return { bindVideo, phase, error, start, stop }
}

export type ScanCamera = ReturnType<typeof createScanCamera>

// 组件内使用：卸载、路由离开、页面转入后台时停止所有轨道。
export function useScanCamera(deps: ScanCameraDeps): ScanCamera {
  const camera = createScanCamera(deps)
  function onVisibility(): void {
    if (document.visibilityState === 'hidden') {
      camera.stop()
    }
  }
  document.addEventListener('visibilitychange', onVisibility)
  onBeforeRouteLeave(() => {
    camera.stop()
  })
  onBeforeUnmount(() => {
    document.removeEventListener('visibilitychange', onVisibility)
    camera.stop()
  })
  return camera
}
