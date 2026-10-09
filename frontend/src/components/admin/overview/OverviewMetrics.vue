<script setup lang="ts">
// 概览指标卡（FE-5 P1）：标签 + 接口返回值，利用率为 null 时显示“—”（格式化在 utils/adminOverviewDisplay）。
import type { MetricView } from '../../../utils/adminOverviewDisplay'
import UiGlassCard from '../../ui/UiGlassCard.vue'

defineProps<{ metrics: MetricView[]; range: string }>()
</script>

<template>
  <section aria-label="指标">
    <p class="range">
      {{ range }}
    </p>
    <ul class="grid">
      <UiGlassCard
        v-for="metric in metrics"
        :key="metric.key"
        tag="li"
        material="solid"
        radius="lg"
        class="metric"
        :data-metric="metric.key"
      >
        <span class="label">{{ metric.label }}</span>
        <strong class="value">{{ metric.value }}</strong>
      </UiGlassCard>
    </ul>
  </section>
</template>

<style scoped>
.range {
  margin-bottom: var(--space-3);
  color: var(--color-text-secondary);
  font: var(--font-footnote);
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: var(--space-3);
  margin: 0;
  padding: 0;
  list-style: none;
}

.metric {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.label {
  color: var(--color-text-secondary);
  font: var(--font-footnote);
}

.value {
  font: var(--font-title);
}
</style>
