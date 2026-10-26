<script setup lang="ts">
// 顶栏右侧（UI-2a-rulings 第 1 节）：数据更新时间、下次刷新倒计时、主题切换、全屏。
// 这是大屏上仅有的两个按钮：只切换本机的显示方式，不调用任何接口（readOnly.spec 核对）。
import { onBeforeUnmount, onMounted, ref } from 'vue'

import type { DisplayTheme } from '../../views/display/displayTheme'
import UiIcon from '../ui/UiIcon.vue'

defineProps<{ updatedText: string | null; countdown: string; theme: DisplayTheme }>()
const emit = defineEmits<{ 'toggle-theme': [] }>()

// Fullscreen API 不可用（例如部分嵌入环境、测试用的 DOM）时不显示全屏按钮。
// .vue 文件里没有浏览器全局变量的 lint 声明，所以经 globalThis 取 document。
const doc: typeof globalThis.document | undefined = globalThis.document
const fullscreenAvailable = doc?.fullscreenEnabled === true
const fullscreen = ref(false)

function inFullscreen(): boolean {
  return (doc?.fullscreenElement ?? null) !== null
}

function syncFullscreen(): void {
  fullscreen.value = inFullscreen()
}

function toggleTheme(): void {
  emit('toggle-theme')
}

function toggleFullscreen(): void {
  const request = inFullscreen() ? doc?.exitFullscreen() : doc?.documentElement.requestFullscreen()
  request?.catch(syncFullscreen)
}

onMounted(() => {
  if (fullscreenAvailable) {
    doc?.addEventListener('fullscreenchange', syncFullscreen)
  }
})
onBeforeUnmount(() => {
  doc?.removeEventListener('fullscreenchange', syncFullscreen)
})
</script>

<template>
  <div class="toolbar">
    <span
      v-if="updatedText !== null"
      class="updated"
    >数据更新于 {{ updatedText }}</span>
    <span class="countdown">
      <UiIcon
        class="countdown-icon"
        name="sync"
      />
      <span>{{ countdown }} 后刷新</span>
    </span>
    <button
      type="button"
      class="tool theme-toggle"
      :aria-label="theme === 'dark' ? '切换为浅色' : '切换为深色'"
      :title="theme === 'dark' ? '切换为浅色' : '切换为深色'"
      @click="toggleTheme"
    >
      <UiIcon :name="theme === 'dark' ? 'sun' : 'moon'" />
    </button>
    <button
      v-if="fullscreenAvailable"
      type="button"
      class="tool fullscreen-toggle"
      :aria-label="fullscreen ? '退出全屏' : '全屏显示'"
      :title="fullscreen ? '退出全屏' : '全屏显示'"
      @click="toggleFullscreen"
    >
      <UiIcon :name="fullscreen ? 'fullscreenExit' : 'fullscreen'" />
    </button>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  gap: 1em;
  color: var(--color-text-secondary);
  font-size: 1.1em;
  white-space: nowrap;
}

.countdown {
  display: inline-flex;
  align-items: center;
  gap: 0.3em;
  padding: 0.15em 0.6em;
  border-radius: var(--radius-sm);
  background: var(--display-soft-accent);
  color: var(--color-accent);
  font-variant-numeric: tabular-nums;
}

.tool {
  display: grid;
  place-items: center;
  width: 2.6em;
  height: 2.6em;
  padding: 0;
  border: 1px solid var(--color-separator);
  border-radius: 50%;
  background: var(--display-track);
  color: var(--color-text);
  font-size: 1.1em;
  cursor: pointer;
  transition: background-color var(--display-motion), border-color var(--display-motion);
}

.tool :deep(.ui-icon) {
  width: 1.3em;
  height: 1.3em;
}

.countdown :deep(.ui-icon) {
  width: 1.1em;
  height: 1.1em;
}

.tool:hover {
  border-color: var(--color-accent-fill);
}

.tool:focus-visible {
  outline: 2px solid var(--color-accent-fill);
  outline-offset: 2px;
}
</style>
