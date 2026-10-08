<script setup lang="ts">
// 顶栏的场馆选择器（FE-5 S3）：选项来自 adminListVenues()，VA 只会收到授权场馆。
import { computed } from 'vue'

import type { VenueSummary } from '../../api/types'
import UiTextField from '../ui/UiTextField.vue'

const props = defineProps<{ venues: VenueSummary[]; venueId: number | null }>()

const emit = defineEmits<{ select: [venueId: number] }>()

const model = computed<number | null>({
  get: () => props.venueId,
  set: (value) => {
    if (value !== null) {
      emit('select', Number(value))
    }
  },
})
</script>

<template>
  <UiTextField
    v-model="model"
    label="场馆"
    control="select"
    class="venue-select"
  >
    <option
      v-for="venue in venues"
      :key="venue.id"
      :value="venue.id"
    >
      {{ venue.name }}
    </option>
  </UiTextField>
</template>

<style scoped>
.venue-select {
  min-width: 200px;
}
</style>
