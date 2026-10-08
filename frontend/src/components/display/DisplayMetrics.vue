<script setup lang="ts">
import type { MetricView } from '../../utils/displayModel'
import UiGlassCard from '../ui/UiGlassCard.vue'

defineProps<{ metrics: MetricView[] }>()
</script>

<template>
  <ul class="metrics">
    <UiGlassCard
      v-for="metric in metrics"
      :key="metric.key"
      tag="li"
      class="metric"
      material="thick"
      :padding="4"
    >
      <span class="label">{{ metric.label }}</span>
      <strong class="value">{{ metric.value }}</strong>
    </UiGlassCard>
  </ul>
</template>

<style scoped>
.metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1.2em;
  margin: 0;
  padding: 0;
  list-style: none;
}

@media (max-width: 800px) {
  .metrics {
    grid-template-columns: minmax(0, 1fr);
  }
}

.metric {
  display: flex;
  flex-direction: column;
  gap: 0.3em;
  padding: 1em 1.4em;
}

.label {
  color: var(--color-text-secondary);
  font-size: 1.2em;
}

.value {
  font-size: 3.4em;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}
</style>
