<script setup lang="ts">
import type { MetricView } from '../../utils/displayModel'

defineProps<{ metrics: MetricView[] }>()
</script>

<template>
  <ul class="metrics">
    <li
      v-for="metric in metrics"
      :key="metric.key"
      class="metric"
    >
      <span class="label">{{ metric.label }}</span>
      <strong class="value">{{ metric.value }}</strong>
    </li>
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

.metric {
  display: flex;
  flex-direction: column;
  gap: 0.3em;
  padding: 1em 1.4em;
  background: var(--display-panel);
  border: 1px solid var(--display-border);
  border-radius: 0.6em;
}

.label {
  font-size: 1.2em;
  color: var(--display-muted);
}

.value {
  font-size: 3.4em;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}
</style>
