<script setup lang="ts">
// 扫码结果（P2-1c 裁决第 3 节）：成功显示预约人、场地、时段与签到时刻；失败按错误码显示文案与补充说明。
// 区域是 aria-live，结果变化时读屏会读出。
import type { ScanOutcome } from '../../../utils/checkInDisplay'

defineProps<{ outcome: ScanOutcome | null }>()
</script>

<template>
  <div
    class="result"
    :class="outcome === null ? 'idle' : outcome.ok ? 'ok' : 'err'"
    :data-result="outcome === null ? 'idle' : outcome.ok ? 'ok' : 'error'"
    aria-live="polite"
  >
    <template v-if="outcome === null">
      等待扫码…
    </template>
    <template v-else>
      <strong class="result-title">{{ outcome.title }}</strong>
      <p v-if="outcome.detail !== null">
        {{ outcome.detail }}
      </p>
      <dl v-if="outcome.facts.length > 0">
        <template
          v-for="fact in outcome.facts"
          :key="fact.label"
        >
          <dt>{{ fact.label }}</dt>
          <dd>{{ fact.value }}</dd>
        </template>
      </dl>
    </template>
  </div>
</template>

<style scoped>
.result {
  padding: var(--space-3) var(--space-4);
  border-left: 4px solid transparent;
  border-radius: var(--radius-sm);
  font: var(--font-callout);
}

.idle {
  background: var(--admin-fill-1);
  color: var(--color-text-secondary);
}

.ok {
  border-left-color: var(--color-success);
  background: color-mix(in srgb, var(--color-success) 12%, var(--color-surface));
}

.err {
  border-left-color: var(--color-danger);
  background: color-mix(in srgb, var(--color-danger) 10%, var(--color-surface));
}

.result-title {
  display: block;
  margin-bottom: var(--space-1);
  font: var(--font-headline);
}

dl {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: var(--space-1) var(--space-3);
  margin: var(--space-2) 0 0;
}

dt {
  color: var(--color-text-secondary);
}

dd {
  margin: 0;
  overflow-wrap: anywhere;
}
</style>
