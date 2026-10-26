<script setup lang="ts">
// 场地状态图例（UI-2a）：五种状态的圆点与中文名，色调与场地方块、环形图相同（toneForResourceState）。
import type { ResourceLiveState } from '../../api/types'
import { stateLabel } from '../../utils/displayModel'
import { toneForResourceState } from '../../utils/statusTone'

const STATES: ResourceLiveState[] = ['FREE', 'RESERVED', 'IN_USE', 'MAINTENANCE', 'DISABLED']
</script>

<template>
  <ul
    class="legend"
    aria-label="场地状态图例"
  >
    <li
      v-for="state in STATES"
      :key="state"
      class="legend-item"
    >
      <span
        class="legend-dot"
        :class="`legend-dot--${toneForResourceState(state)}`"
        aria-hidden="true"
      />{{ stateLabel(state) }}
    </li>
  </ul>
</template>

<style scoped>
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4em 1.4em;
  margin: 0;
  padding: 0 0.2em;
  color: var(--color-text-secondary);
  font-size: 1em;
  list-style: none;
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 0.4em;
}

.legend-dot {
  width: 0.6em;
  height: 0.6em;
  border-radius: 50%;
}

.legend-dot--accent { background: var(--color-accent-fill); }
.legend-dot--success { background: var(--color-success); }
.legend-dot--warning { background: var(--color-warning); }
.legend-dot--danger { background: var(--color-danger); }
.legend-dot--neutral { background: var(--color-neutral); }
</style>
