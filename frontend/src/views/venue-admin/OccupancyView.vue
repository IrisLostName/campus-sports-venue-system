<script setup lang="ts">
// 场地占用总览（FE-5 P5）：所选场馆某日每个场地各时段的占用。
import { onMounted } from 'vue'

import AdminPage from '../../components/admin/AdminPage.vue'
import OccupancyGrid from '../../components/admin/occupancy/OccupancyGrid.vue'
import UiTextField from '../../components/ui/UiTextField.vue'
import { useCurrentVenue } from '../../composables/adminVenue'
import { useAdminOccupancy } from '../../composables/adminOccupancy'

const { venueId } = useCurrentVenue()
const { date, occupancy, grid, error, load, setDate } = useAdminOccupancy(venueId)

onMounted(load)
</script>

<template>
  <AdminPage
    title="场地占用总览"
    :error="error"
  >
    <template #actions>
      <UiTextField
        :model-value="date"
        label="日期"
        type="date"
        @update:model-value="setDate"
      />
    </template>
    <template v-if="occupancy !== null && grid !== null">
      <p class="hint">
        {{ occupancy.venueName }} · {{ occupancy.date }} · 场地数量 {{ occupancy.resourceCount }}
      </p>
      <OccupancyGrid :grid="grid" />
    </template>
  </AdminPage>
</template>
