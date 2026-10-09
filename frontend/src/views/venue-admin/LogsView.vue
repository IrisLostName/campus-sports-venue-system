<script setup lang="ts">
// 操作记录（FE-5 P8）：所选场馆的管理员操作留痕，时间倒序。
import { onMounted } from 'vue'

import AdminPage from '../../components/admin/AdminPage.vue'
import AdminPagination from '../../components/admin/AdminPagination.vue'
import LogFilters from '../../components/admin/logs/LogFilters.vue'
import LogTable from '../../components/admin/logs/LogTable.vue'
import { useCurrentVenue } from '../../composables/adminVenue'
import { useAdminLogs } from '../../composables/adminLogs'

const { venueId } = useCurrentVenue()
const { filters, rows, list, search, load, goTo } = useAdminLogs(venueId)
const { page, pageSize, total, loaded, busy, error } = list

onMounted(load)
</script>

<template>
  <AdminPage
    title="操作记录"
    :error="error"
  >
    <LogFilters
      v-model:filters="filters"
      :busy="busy"
      @search="search"
    />
    <template v-if="loaded">
      <LogTable :rows="rows" />
      <AdminPagination
        :page="page"
        :page-size="pageSize"
        :total="total"
        :busy="busy"
        @change="goTo"
      />
    </template>
  </AdminPage>
</template>
