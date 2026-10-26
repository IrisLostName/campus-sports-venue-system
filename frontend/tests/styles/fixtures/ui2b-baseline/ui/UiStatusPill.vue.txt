<script setup lang="ts">
// 状态胶囊（docs/17 第 6 节）。tone 只决定圆点与浅色底；文字一律是 --color-text（对比度规则，docs/17 第 2 节）。
import type { Tone } from '../../utils/statusTone'

defineProps<{ tone: Tone }>()
</script>

<template>
  <span
    class="ui-status-pill"
    :class="`ui-status-pill--${tone}`"
  >
    <span
      class="dot"
      aria-hidden="true"
    />
    <slot />
  </span>
</template>

<style scoped>
.ui-status-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 10px;
  border-radius: var(--radius-capsule);
  background: color-mix(in srgb, var(--pill-tone) var(--tint-strength), transparent);
  color: var(--color-text);
  font: var(--font-caption);
  font-weight: 600;
  white-space: nowrap;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--pill-tone);
}

.ui-status-pill--accent { --pill-tone: var(--color-accent); }
.ui-status-pill--success { --pill-tone: var(--color-success); }
.ui-status-pill--warning { --pill-tone: var(--color-warning); }
.ui-status-pill--danger { --pill-tone: var(--color-danger); }
.ui-status-pill--neutral { --pill-tone: var(--color-neutral); }
</style>
