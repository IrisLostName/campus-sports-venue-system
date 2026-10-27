// 签到码浮层的轮播、焦点与键盘（P2-1c，供 components/reservation/CheckInCodeSheet 使用）：
// - 当前是第几张：按滚动位置取最近的一张（每帧至多算一次）；←/→ 与指示点切换，减少动效时不平滑滚动；
// - 打开时定位到所点的那张并聚焦“关闭”，Tab 在浮层内循环；关闭后焦点回到打开它的按钮。
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'

import { slideIndex } from '../utils/checkInDisplay'

export interface CarouselSource {
  open: () => boolean
  count: () => number
  startIndex: () => number
}

const FOCUSABLE = 'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

function reducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

// Tab 在 root 内循环（aria-modal 之外再加一层保证，不依赖读屏软件）；inert 中的元素不算。
function trapTab(root: HTMLElement, event: KeyboardEvent): void {
  const focusable = [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((element) => element.closest('[inert]') === null)
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  if (first === undefined || last === undefined) {
    return
  }
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

export function useCheckInCarousel(source: CarouselSource) {
  const panel = ref<HTMLElement | null>(null)
  const closeButton = ref<HTMLButtonElement | null>(null)
  const carousel = ref<HTMLElement | null>(null)
  const index = ref(0)
  let opener: HTMLElement | null = null
  let frame = 0

  function scrollToIndex(target: number, smooth: boolean): void {
    const clamped = Math.min(Math.max(target, 0), Math.max(source.count() - 1, 0))
    index.value = clamped
    const element = carousel.value
    if (element === null) {
      return
    }
    const left = clamped * element.clientWidth
    if (typeof element.scrollTo === 'function') {
      element.scrollTo({ left, behavior: smooth && !reducedMotion() ? 'smooth' : 'auto' })
    } else {
      element.scrollLeft = left
    }
  }

  function onScroll(): void {
    if (frame !== 0) {
      return
    }
    frame = requestAnimationFrame(() => {
      frame = 0
      const element = carousel.value
      if (element !== null) {
        index.value = slideIndex(element.scrollLeft, element.clientWidth, source.count())
      }
    })
  }

  function onCarouselKey(event: KeyboardEvent): void {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault()
      scrollToIndex(index.value + (event.key === 'ArrowRight' ? 1 : -1), true)
    }
  }

  function onPanelKey(event: KeyboardEvent): void {
    if (event.key === 'Tab' && panel.value !== null) {
      trapTab(panel.value, event)
    }
  }

  watch(source.open, async (open) => {
    if (open) {
      opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
      index.value = source.startIndex()
      await nextTick()
      scrollToIndex(source.startIndex(), false)
      closeButton.value?.focus({ preventScroll: true })
    } else {
      opener?.focus({ preventScroll: true })
      opener = null
    }
  }, { immediate: true })

  onBeforeUnmount(() => cancelAnimationFrame(frame))

  // 模板里用函数 ref 绑定元素（:ref="bindPanel" 等）。
  const bindPanel = (element: unknown) => { panel.value = element instanceof HTMLElement ? element : null }
  const bindClose = (element: unknown) => { closeButton.value = element instanceof HTMLButtonElement ? element : null }
  const bindCarousel = (element: unknown) => { carousel.value = element instanceof HTMLElement ? element : null }

  return { bindPanel, bindClose, bindCarousel, index, scrollToIndex, onScroll, onCarouselKey, onPanelKey }
}
