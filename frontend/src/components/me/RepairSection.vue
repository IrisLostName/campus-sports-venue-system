<script setup lang="ts">
import { onMounted } from 'vue'

import { useRepairBoard } from '../../composables/repairBoard'
import UiBanner from '../ui/UiBanner.vue'
import RepairForm from './RepairForm.vue'
import RepairList from './RepairList.vue'

const board = useRepairBoard()
const {
  venues, venuesError, items, listError, listLoaded, venueId, description, submitting, formError, notice,
} = board

onMounted(() => {
  void board.load()
})
</script>

<template>
  <section
    class="section"
    aria-label="报修"
  >
    <h2>报修</h2>
    <UiBanner
      v-if="venuesError !== null"
      class="error"
      tone="danger"
      role="alert"
    >
      场馆列表加载失败：{{ venuesError }}
    </UiBanner>
    <RepairForm
      v-model:venue-id="venueId"
      v-model:description="description"
      :venues="venues"
      :submitting="submitting"
      :error="formError"
      :notice="notice"
      @submit="board.submit()"
    />
    <RepairList
      :items="items"
      :loaded="listLoaded"
      :error="listError"
      @retry="board.reloadList()"
    />
  </section>
</template>

<style scoped>
.section {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

h2 {
  padding-inline: var(--space-1);
  font: var(--font-title);
}
</style>
