<script setup lang="ts">
import type { SlotGroup } from '../../utils/bookingDisplay'

defineProps<{ groups: SlotGroup[] }>()

defineEmits<{ select: [resourceId: number, startTime: string] }>()
</script>

<template>
  <section
    v-for="group in groups"
    :key="group.resourceId"
    class="group"
    :aria-label="group.resourceName"
  >
    <h3>{{ group.resourceName }}</h3>
    <div class="cells">
      <button
        v-for="cell in group.cells"
        :key="cell.startTime"
        type="button"
        class="cell"
        :class="{ selected: cell.selected }"
        :data-status="cell.status"
        :disabled="!cell.selectable"
        :aria-pressed="cell.selected"
        @click="$emit('select', group.resourceId, cell.startTime)"
      >
        <span class="time">{{ cell.timeText }}</span>
        <span class="label">{{ cell.label }}</span>
      </button>
    </div>
  </section>
</template>

<style scoped>
.group {
  margin-bottom: 16px;
}

h3 {
  margin: 0 0 8px;
  font-size: 16px;
}

.cells {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.cell {
  min-height: 52px;
  padding: 6px 8px;
  border: 1px solid #0b6b4f;
  border-radius: 10px;
  background: #ffffff;
  color: #0b6b4f;
  cursor: pointer;
}

.time,
.label {
  display: block;
}

.time {
  font-size: 15px;
  font-weight: 600;
}

.label {
  font-size: 13px;
}

.cell.selected {
  background: #0b6b4f;
  color: #ffffff;
}

.cell:disabled {
  border-color: #dde3ea;
  background: #f1f4f8;
  color: #8a94a1;
  cursor: not-allowed;
}

/* 我的预约：醒目但不可选。 */
.cell[data-status='MINE']:disabled {
  border-color: #d98200;
  background: #fff4e0;
  color: #8a4b00;
  font-weight: 600;
}
</style>
