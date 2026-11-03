// 首页图集的轮播（UI-6）：每次进入页面打乱一次顺序；每 5 秒换下一张，到末尾回到第一张。
// 减少动态效果时不自动换图（指示点仍可切换）。点指示点后重新计时。
import { onBeforeUnmount, onMounted, ref } from 'vue'

import { shuffle } from '../utils/gallery'

export const GALLERY_INTERVAL_MS = 5000

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function useHomeGallery(files: readonly string[], rng: () => number = Math.random) {
  const order = shuffle(files, rng)
  const index = ref(0)
  const reducedMotion = prefersReducedMotion()
  let timer: ReturnType<typeof setInterval> | undefined

  function stop(): void {
    if (timer !== undefined) {
      clearInterval(timer)
      timer = undefined
    }
  }

  function start(): void {
    stop()
    if (!reducedMotion && order.length > 1) {
      timer = setInterval(() => {
        index.value = (index.value + 1) % order.length
      }, GALLERY_INTERVAL_MS)
    }
  }

  function show(target: number): void {
    index.value = target
    start()
  }

  onMounted(start)
  onBeforeUnmount(stop)

  return { order, index, reducedMotion, show }
}
