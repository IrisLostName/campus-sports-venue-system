<script setup lang="ts">
// 操作记录（FE-5 P8）：所选场馆的管理员操作留痕，时间倒序。系统管理员端可选“全部场馆”（FE-6 G6）。
import { onMounted } from 'vue'

import AdminPage from '../../components/admin/AdminPage.vue'
import AdminPagination from '../../components/admin/AdminPagination.vue'
import LogFilters from '../../components/admin/logs/LogFilters.vue'
import LogTable from '../../components/admin/logs/LogTable.vue'
import { useOptionalVenue } from '../../composables/adminVenue'
import { useAdminLogs } from '../../composables/adminLogs'

const { venueId } = useOptionalVenue()
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
      <LogTable
        :rows="rows"
        :show-venue="venueId === undefined"
      />
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
