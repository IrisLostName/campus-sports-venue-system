<script setup lang="ts">
// 场地占用总览网格（FE-5 P5）：行是场地，列是时段；格子显示状态，有预约时显示预约人与展示状态。
import type { OccupancyGridView } from '../../../utils/occupancyDisplay'
import UiEmptyState from '../../ui/UiEmptyState.vue'
import UiGlassCard from '../../ui/UiGlassCard.vue'
import UiStatusPill from '../../ui/UiStatusPill.vue'

defineProps<{ grid: OccupancyGridView }>()
</script>

<template>
  <UiGlassCard
    material="solid"
    :padding="0"
    radius="lg"
    class="grid-card"
  >
    <UiEmptyState
      v-if="grid.columns.length === 0"
      title="当天没有开放时段"
    />
    <table
      v-else
      class="grid"
    >
      <caption class="sr-only">
        场地占用总览
      </caption>
      <thead>
        <tr>
          <th scope="col">
            场地
          </th>
          <th
            v-for="column in grid.columns"
            :key="column.startTime"
            scope="col"
          >
            {{ column.timeText }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="row in grid.rows"
          :key="row.resourceId"
          :data-resource="row.resourceId"
        >
          <th scope="row">
            <div class="resource">
              <span class="name">{{ row.resourceName }}</span>
              <UiStatusPill :tone="row.statusTone">
                {{ row.statusLabel }}
              </UiStatusPill>
            </div>
          </th>
          <td
            v-for="(cell, index) in row.cells"
            :key="grid.columns[index]?.startTime"
            :data-slot="grid.columns[index]?.startTime"
          >
            <template v-if="cell !== null">
              <UiStatusPill :tone="cell.tone">
                {{ cell.statusLabel }}
              </UiStatusPill>
              <div
                v-if="cell.reservation !== null"
                class="who"
              >
                <span class="person">{{ cell.reservation.userDisplayName }}</span>
                <UiStatusPill :tone="cell.reservation.tone">
                  {{ cell.reservation.statusLabel }}
                </UiStatusPill>
              </div>
            </template>
            <span
              v-else
              class="none"
            >—</span>
          </td>
        </tr>
      </tbody>
    </table>
  </UiGlassCard>
</template>

<style scoped>
.grid-card {
  overflow-x: auto;
}

.grid {
  width: 100%;
  border-collapse: collapse;
  font: var(--font-callout);
}

thead th {
  padding: var(--space-3);
  color: var(--color-text-secondary);
  font: var(--font-footnote);
  font-weight: 600;
  text-align: left;
  white-space: nowrap;
}

tbody th {
  position: sticky;
  left: 0;
  min-width: 110px;
  padding: var(--space-3);
  border-top: 1px solid var(--color-separator);
  background: var(--color-surface);
  font-weight: 600;
  text-align: left;
}

.resource {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-1);
}

td {
  min-width: 120px;
  padding: var(--space-3);
  border-top: 1px solid var(--color-separator);
  vertical-align: top;
}

.who {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-1);
  margin-top: var(--space-2);
}

.person {
  font-weight: 600;
}

.none {
  color: var(--color-text-secondary);
}
</style>
