// 浮层的 Esc 关闭（FE-8 L5）：同一时刻只有最上层（最后打开）的浮层响应 Esc。
// 一个 window 级的 keydown 监听由所有打开的浮层共用：第一个浮层打开时挂上，最后一个关闭或卸载时摘掉。
import { onBeforeUnmount, watch } from 'vue'

interface Layer {
  onEscape: () => void
}

const layers: Layer[] = []

function handleKeydown(event: KeyboardEvent): void {
  if (event.key !== 'Escape' || event.defaultPrevented || event.isComposing) {
    return
  }
  layers[layers.length - 1]?.onEscape()
}

function add(layer: Layer): void {
  if (layers.includes(layer)) {
    return
  }
  if (layers.length === 0) {
    window.addEventListener('keydown', handleKeydown)
  }
  layers.push(layer)
}

function remove(layer: Layer): void {
  const index = layers.indexOf(layer)
  if (index < 0) {
    return
  }
  layers.splice(index, 1)
  if (layers.length === 0) {
    window.removeEventListener('keydown', handleKeydown)
  }
}

// isOpen 为真期间，这个浮层参与 Esc 排队；它在最上层时按 Esc 会调用 onEscape。
export function useEscapeClose(isOpen: () => boolean, onEscape: () => void): void {
  const layer: Layer = { onEscape }
  watch(isOpen, (open) => {
    if (open) {
      add(layer)
    } else {
      remove(layer)
    }
  }, { immediate: true })
  onBeforeUnmount(() => remove(layer))
}
