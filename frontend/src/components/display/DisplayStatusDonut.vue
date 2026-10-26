<script setup lang="ts">
// 场地实时状态（UI-2a-rulings 第 1 节）：环形图按 resources[].state 计数，中心是场地总数，旁边的图例写明各状态的数量。
// 色调与场地方块相同（toneForResourceState，第 6 节第 6 条）；数量为 0 的状态不画弧段，但仍列在图例里。
import { computed } from 'vue'

import type { StateCountView } from '../../utils/displayModel'
import { toneForResourceState } from '../../utils/statusTone'
import UiGlassCard from '../ui/UiGlassCard.vue'
import UiIcon from '../ui/UiIcon.vue'
import { DONUT_RADIUS, donutSegments } from './chartGeometry'

const props = defineProps<{ breakdown: StateCountView[]; total: number }>()

const segments = computed(() => donutSegments(props.breakdown, (item) => item.count))
const summary = computed(() =>
  `场地实时状态：${props.breakdown.map((item) => `${item.label} ${item.count}`).join('，')}，共 ${props.total} 个场地`)
</script>

<template>
  <UiGlassCard
    tag="section"
    class="donut display-panel"
    material="solid"
    radius="sm"
  >
    <h3 class="title display-panel-title">
      <UiIcon
        class="panel-title-icon"
        name="pie"
      />
      场地实时状态
    </h3>
    <div class="body">
      <div class="ring">
        <svg
          class="ring-svg"
          viewBox="0 0 42 42"
          role="img"
          :aria-label="summary"
        >
          <circle
            class="ring-track"
            cx="21"
            cy="21"
            :r="DONUT_RADIUS"
          />
          <circle
            v-for="segment in segments"
            :key="segment.item.state"
            class="ring-segment"
            :class="`tone-${toneForResourceState(segment.item.state)}`"
            cx="21"
            cy="21"
            :r="DONUT_RADIUS"
            :stroke-dasharray="segment.dashArray"
            :stroke-dashoffset="segment.dashOffset"
          />
        </svg>
        <span
          class="center"
          aria-hidden="true"
        >
          <strong class="total">{{ total }}</strong>
          <span class="total-label">场地总数</span>
        </span>
      </div>
      <ul class="counts">
        <li
          v-for="item in breakdown"
          :key="item.state"
          class="count-item"
          :class="`tone-${toneForResourceState(item.state)}`"
        >
          <span
            class="dot"
            aria-hidden="true"
          />
          <span class="count-label">{{ item.label }}</span>
          <span class="count-value">{{ item.count }}</span>
        </li>
      </ul>
    </div>
  </UiGlassCard>
</template>

<style scoped>
.body {
  display: flex;
  align-items: center;
  gap: 1.6em;
}

.ring {
  position: relative;
  flex: none;
  width: 8.5em;
  height: 8.5em;
}

.ring-svg {
  display: block;
  width: 100%;
  height: 100%;
}

.ring-track,
.ring-segment {
  fill: none;
  stroke-width: 6;
}

.ring-track {
  stroke: var(--display-track);
}

.ring-segment {
  stroke: var(--tone);
  transition: stroke-dasharray var(--display-motion), stroke-dashoffset var(--display-motion);
}

.center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.total {
  font-size: 1.7em;
  font-weight: 600;
  line-height: 1.1;
  font-variant-numeric: tabular-nums;
}

.total-label {
  color: var(--color-text-secondary);
  font-size: 1em;
}

.counts {
  display: grid;
  flex: 1;
  gap: 0.35em;
  margin: 0;
  padding: 0;
  list-style: none;
}

.count-item {
  display: flex;
  align-items: center;
  gap: 0.5em;
  font-size: 1.05em;
}

.dot {
  width: 0.6em;
  height: 0.6em;
  border-radius: 50%;
  background: var(--tone);
}

.count-label {
  flex: 1;
  color: var(--color-text-secondary);
}

.count-value {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
</style>
