<script setup lang="ts">
// “今日概览”（UI-2a-rulings 第 1 节）：今日预约量、当前使用、今日利用率、开放场地 X/Y。
// .value 只放数值（与接口一致，测试按它取值），单位放在旁边的 .unit 里。
import { computed } from 'vue'

import type { MetricView, OpenResourcesView } from '../../utils/displayModel'
import UiGlassCard from '../ui/UiGlassCard.vue'
import UiIcon from '../ui/UiIcon.vue'
import type { UiIconName } from '../../utils/icons'

const props = defineProps<{ metrics: MetricView[]; openResources: OpenResourcesView }>()

type IconTone = 'blue' | 'orange' | 'green' | 'purple'

const DECOR: Record<MetricView['key'], { icon: UiIconName; tone: IconTone; unit: string }> = {
  reservations: { icon: 'calendar', tone: 'blue', unit: '单' },
  inUse: { icon: 'bolt', tone: 'orange', unit: '个场地' },
  utilization: { icon: 'gauge', tone: 'green', unit: '' },
  openResources: { icon: 'apps', tone: 'purple', unit: '' },
}

const items = computed(() => [
  ...props.metrics,
  { key: 'openResources' as const, label: '开放场地', value: props.openResources.text },
].map((metric) => ({ ...metric, ...DECOR[metric.key] })))
</script>

<template>
  <UiGlassCard
    tag="section"
    class="overview"
    material="solid"
    radius="sm"
    :padding="0"
  >
    <header class="overview-head">
      <h2 class="overview-title">
        <UiIcon
          class="panel-title-icon"
          name="activity"
        />
        今日概览
      </h2>
      <span class="overview-note">只读聚合指标，不含个人信息</span>
    </header>
    <ul class="metrics">
      <li
        v-for="metric in items"
        :key="metric.key"
        class="metric"
      >
        <span
          class="icon"
          :class="`icon--${metric.tone}`"
        >
          <UiIcon :name="metric.icon" />
        </span>
        <span class="text">
          <span class="label">{{ metric.label }}</span>
          <span class="figure">
            <strong class="value">{{ metric.value }}</strong>
            <span
              v-if="metric.unit !== ''"
              class="unit"
            >{{ metric.unit }}</span>
          </span>
        </span>
      </li>
    </ul>
  </UiGlassCard>
</template>

<style scoped>
.overview-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1em;
  padding: 0.8em 1.6em 0;
}

.overview-title {
  margin: 0;
  font-size: 1.35em;
  font-weight: 600;
}

.overview-note {
  color: var(--color-text-secondary);
  font-size: 1em;
}

.metrics {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin: 0;
  padding: 0.8em 0 1em;
  list-style: none;
}

@media (max-width: 800px) {
  .metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    row-gap: 1em;
  }
}

.metric {
  display: flex;
  align-items: center;
  gap: 1.2em;
  min-width: 0;
  padding: 0.2em 1.6em;
}

.metric + .metric {
  border-left: 1px solid var(--color-separator);
}

.icon {
  display: grid;
  flex: none;
  place-items: center;
  width: 2.2em;
  height: 2.2em;
  border-radius: 50%;
  font-size: 1.8em;
}

.icon :deep(.ui-icon) {
  width: 1.05em;
  height: 1.05em;
}

.icon--blue { background: var(--display-icon-blue-soft); color: var(--display-icon-blue); }
.icon--orange { background: var(--display-icon-orange-soft); color: var(--display-icon-orange); }
.icon--green { background: var(--display-icon-green-soft); color: var(--display-icon-green); }
.icon--purple { background: var(--display-icon-purple-soft); color: var(--display-icon-purple); }

.text {
  display: flex;
  flex-direction: column;
  gap: 0.2em;
  min-width: 0;
}

.label {
  color: var(--color-text-secondary);
  font-size: 1.1em;
}

.figure {
  display: flex;
  align-items: baseline;
  gap: 0.3em;
  white-space: nowrap;
}

.value {
  font-size: 2.2em;
  font-weight: 600;
  line-height: 1.15;
  font-variant-numeric: tabular-nums;
}

.unit {
  color: var(--color-text-secondary);
  font-size: 1.1em;
}
</style>
