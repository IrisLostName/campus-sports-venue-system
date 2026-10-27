<script setup lang="ts">
// 签到二维码（P2-1c）：由 utils/qrMatrix 生成模块路径（二维码库只在那里按需加载），这里画 <svg><path>，不用 v-html。
// 颜色固定为白底深色模块（--qr-paper / --qr-ink，styles/brand.css），深色模式下同样可扫；四周留 4 个模块的静区。
// 图形有文字替代：role="img" + aria-label（“签到二维码”）。
import { ref, watch } from 'vue'

import { qrGraphic, type QrGraphic } from '../../utils/qrMatrix'

const props = defineProps<{ code: string }>()

const QUIET = 4

const graphic = ref<QrGraphic | null>(null)
const failed = ref(false)

watch(() => props.code, async (code) => {
  graphic.value = null
  failed.value = false
  try {
    const result = await qrGraphic(code)
    if (code === props.code) {
      graphic.value = result
    }
  } catch {
    failed.value = true
  }
}, { immediate: true })
</script>

<template>
  <div class="qr">
    <svg
      v-if="graphic !== null"
      class="qr-svg"
      :viewBox="`0 0 ${graphic.size + QUIET * 2} ${graphic.size + QUIET * 2}`"
      shape-rendering="crispEdges"
      role="img"
      aria-label="签到二维码"
    >
      <rect
        class="paper"
        :width="graphic.size + QUIET * 2"
        :height="graphic.size + QUIET * 2"
      />
      <path
        class="ink"
        :transform="`translate(${QUIET} ${QUIET})`"
        :d="graphic.path"
      />
    </svg>
    <p
      v-else-if="failed"
      class="qr-placeholder"
      role="alert"
    >
      二维码生成失败
    </p>
    <div
      v-else
      class="qr-placeholder"
      aria-hidden="true"
    />
  </div>
</template>

<style scoped>
.qr {
  display: grid;
  place-items: center;
}

.qr-svg,
.qr-placeholder {
  width: 210px;
  height: 210px;
}

.paper {
  fill: var(--qr-paper);
}

.ink {
  fill: var(--qr-ink);
}

.qr-placeholder {
  display: grid;
  place-items: center;
  border-radius: var(--radius-md);
  background: color-mix(in srgb, var(--color-neutral) 12%, var(--color-surface));
  color: var(--color-text-secondary);
  font: var(--font-footnote);
}
</style>
