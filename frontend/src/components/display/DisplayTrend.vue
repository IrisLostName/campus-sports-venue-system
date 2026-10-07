<script setup lang="ts">
import type { TrendBarView } from '../../utils/displayModel'

defineProps<{ bars: TrendBarView[] }>()
</script>

<template>
  <section class="trend">
    <h3 class="title">
      本周预约趋势
    </h3>
    <ul class="bars">
      <li
        v-for="bar in bars"
        :key="bar.date"
        class="bar"
      >
        <span class="count">{{ bar.count }}</span>
        <span class="track">
          <span
            class="fill"
            :style="{ height: `${bar.heightPercent}%` }"
          />
        </span>
        <span class="date">{{ bar.label }}</span>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.trend {
  padding: 0.8em 1.2em 1em;
  background: var(--display-panel);
  border: 1px solid var(--display-border);
  border-radius: 0.6em;
}

.title {
  margin: 0 0 0.6em;
  font-size: 1.5em;
}

.bars {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 0.6em;
  height: 12em;
  margin: 0;
  padding: 0;
  list-style: none;
}

.bar {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3em;
  min-height: 0;
}

.track {
  flex: 1;
  display: flex;
  align-items: flex-end;
  width: 100%;
  min-height: 0;
  border-bottom: 1px solid var(--display-border);
}

.fill {
  display: block;
  width: 100%;
  background: #5aa9ff;
  border-radius: 0.25em 0.25em 0 0;
}

.count {
  font-size: 1.1em;
  font-variant-numeric: tabular-nums;
}

.date {
  font-size: 0.95em;
  color: var(--display-muted);
}
</style>
