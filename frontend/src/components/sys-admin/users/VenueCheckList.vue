<script setup lang="ts">
// 场馆多选（FE-6 G2）：授权范围与新建管理员共用。选项来自 adminListVenues()，值是场馆 id 数组。
import type { VenueSummary } from '../../../api/types'

const selected = defineModel<number[]>({ required: true })

defineProps<{ venues: readonly VenueSummary[]; legend: string }>()

function toggle(id: number, checked: boolean): void {
  const rest = selected.value.filter((item) => item !== id)
  selected.value = checked ? [...rest, id] : rest
}
</script>

<template>
  <fieldset class="check-list">
    <legend>{{ legend }}</legend>
    <label
      v-for="venue in venues"
      :key="venue.id"
      class="item"
    >
      <input
        type="checkbox"
        :value="venue.id"
        :checked="selected.includes(venue.id)"
        @change="toggle(venue.id, ($event.target as HTMLInputElement).checked)"
      >
      {{ venue.name }}
    </label>
  </fieldset>
</template>

<style scoped>
.check-list {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  margin: 0;
  padding: 0;
  border: 0;
}

.check-list legend {
  padding: 0 0 var(--space-2);
  color: var(--color-text-secondary);
  font: var(--font-footnote);
}

.item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  min-height: 44px;
}

.item input {
  width: 20px;
  height: 20px;
  accent-color: var(--color-accent-fill);
}
</style>
