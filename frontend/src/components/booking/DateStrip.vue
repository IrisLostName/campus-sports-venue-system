<script setup lang="ts">
import { computed } from 'vue'

import type { DateOption } from '../../utils/bookingDisplay'
import UiSegmented from '../ui/UiSegmented.vue'

const props = defineProps<{ dates: DateOption[]; selected: string | null }>()

const emit = defineEmits<{ select: [date: string] }>()

const items = computed(() => props.dates.map((option) => ({
  value: option.value,
  label: option.dayText,
  sub: option.weekdayText,
})))

function onSelect(value: string | null): void {
  if (value !== null) {
    emit('select', value)
  }
}
</script>

<template>
  <UiSegmented
    :items="items"
    :model-value="selected"
    label="选择日期"
    layout="scroll"
    item-class="day"
    value-attribute="data-date"
    @update:model-value="onSelect"
  />
</template>
