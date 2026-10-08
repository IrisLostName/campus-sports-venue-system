<script setup lang="ts">
import type { DateOption } from '../../utils/bookingDisplay'

defineProps<{ dates: DateOption[]; selected: string | null }>()

defineEmits<{ select: [date: string] }>()
</script>

<template>
  <div
    class="strip"
    role="group"
    aria-label="选择日期"
  >
    <button
      v-for="option in dates"
      :key="option.value"
      type="button"
      class="day"
      :class="{ active: option.value === selected }"
      :aria-pressed="option.value === selected"
      :data-date="option.value"
      @click="$emit('select', option.value)"
    >
      <span class="num">{{ option.dayText }}</span>
      <span class="week">{{ option.weekdayText }}</span>
    </button>
  </div>
</template>

<style scoped>
.strip {
  display: flex;
  gap: 8px;
  padding-bottom: 4px;
  overflow-x: auto;
}

.day {
  flex: none;
  min-width: 64px;
  min-height: 56px;
  padding: 6px 10px;
  border: 1px solid #c8d0da;
  border-radius: 10px;
  background: #ffffff;
  color: #1f2933;
  cursor: pointer;
}

.num,
.week {
  display: block;
}

.num {
  font-size: 16px;
  font-weight: 600;
}

.week {
  font-size: 13px;
}

.day.active {
  border-color: #0b6b4f;
  background: #0b6b4f;
  color: #ffffff;
}
</style>
