<script setup lang="ts">
// 系统管理员端外壳（FE-6 S1–S4）：AdminShell + 两组导航 + 场馆选择。场馆运营五页复用场馆管理员端的页面，上下文由本外壳提供。
// 页面只在场馆要求满足后渲染：scope=venue 的页面需要选定场馆；venue-or-all 的页面“全部场馆”即不带 venueId。
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'

import AdminShell from '../../components/admin/AdminShell.vue'
import AdminVenueSelect from '../../components/admin/AdminVenueSelect.vue'
import UiBanner from '../../components/ui/UiBanner.vue'
import UiButton from '../../components/ui/UiButton.vue'
import UiEmptyState from '../../components/ui/UiEmptyState.vue'
import { useAdminVenueContext } from '../../composables/adminVenue'
import { PATHS } from '../../router/paths'
import { SYS_ADMIN_NAV, scopeOfPath } from '../../router/sysAdminNav'
import type { AdminNavItem } from '../../utils/adminNav'

const route = useRoute()
const scope = computed(() => scopeOfPath(route.path))
const { venues, loaded, error, venueId, load, select } = useAdminVenueContext({ allowAll: () => scope.value !== 'venue' })

// 带场馆要求的链接携带当前所选场馆；全局页面的链接不带。
const items = computed<AdminNavItem[]>(() => SYS_ADMIN_NAV.map((entry) => ({
  label: entry.label,
  group: entry.group,
  to: venueId.value === null || entry.scope === 'none'
    ? entry.path
    : { path: entry.path, query: { venueId: String(venueId.value) } },
})))

const showSelect = computed(() => loaded.value && scope.value !== 'none')
const noVenues = computed(() => loaded.value && scope.value === 'venue' && venues.value.length === 0)
const ready = computed(() => loaded.value && (scope.value !== 'venue' || venueId.value !== null))
const pageKey = computed(() => (scope.value === 'none' ? 'global' : String(venueId.value ?? 'all')))

onMounted(load)
</script>

<template>
  <AdminShell
    brand="系统管理端"
    :items="items"
  >
    <template #toolbar>
      <AdminVenueSelect
        v-if="showSelect"
        :venues="venues"
        :venue-id="venueId"
        :allow-all="scope === 'venue-or-all'"
        @select="select"
      />
    </template>
    <div
      v-if="error"
      class="failed"
    >
      <UiBanner
        tone="danger"
        role="alert"
      >
        {{ error }}
      </UiBanner>
      <UiButton
        variant="secondary"
        @click="load"
      >
        重试
      </UiButton>
    </div>
    <UiEmptyState
      v-else-if="noVenues"
      title="还没有场馆"
      description="请先到“场馆资料与开关”新增场馆。"
    >
      <template #action>
        <UiButton :to="PATHS.sysAdmin">
          前往新增场馆
        </UiButton>
      </template>
    </UiEmptyState>
    <RouterView
      v-else-if="ready"
      :key="pageKey"
    />
    <p
      v-else
      class="hint"
    >
      加载中…
    </p>
  </AdminShell>
</template>

<style scoped>
.failed {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-3);
}
</style>
