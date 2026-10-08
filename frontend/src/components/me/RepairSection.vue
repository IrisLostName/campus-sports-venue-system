<script setup lang="ts">
import { onMounted } from 'vue'

import { useRepairBoard } from '../../composables/repairBoard'
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
    <p
      v-if="venuesError !== null"
      class="error"
      role="alert"
    >
      场馆列表加载失败：{{ venuesError }}
    </p>
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
h2 {
  margin: 0 0 8px;
  font-size: 17px;
}

.error {
  margin: 0 0 8px;
  color: #b3261e;
  font-size: 14px;
}
</style>
