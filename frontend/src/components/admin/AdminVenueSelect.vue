<script setup lang="ts">
// 顶栏的场馆选择器（FE-5 S3）：选项来自 adminListVenues()，VA 只会收到授权场馆。
import { computed } from 'vue'

import type { VenueSummary } from '../../api/types'
import UiTextField from '../ui/UiTextField.vue'

// allowAll（FE-6）：多一个“全部场馆”选项，选中时发出 null；缺省不出现，行为与 FE-5 相同。
const props = withDefaults(defineProps<{ venues: VenueSummary[]; venueId: number | null; allowAll?: boolean }>(), {
  allowAll: false,
})

const emit = defineEmits<{ select: [venueId: number | null] }>()

const model = computed<number | null>({
  get: () => props.venueId,
  set: (value) => {
    if (value !== null) {
      emit('select', Number(value))
    } else if (props.allowAll) {
      emit('select', null)
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
      v-if="allowAll"
      :value="null"
    >
      全部场馆
    </option>
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
