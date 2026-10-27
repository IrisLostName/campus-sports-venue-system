<script setup lang="ts">
// 场馆管理员端外壳（FE-5 S1–S4）：AdminShell + 八项导航 + 场馆选择（扫码签到页不显示场馆选择）。页面只在场馆确定后渲染，并按 venueId 重建（切换场馆即重新取数）。
import { computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'

import AdminShell from '../../components/admin/AdminShell.vue'
import AdminVenueSelect from '../../components/admin/AdminVenueSelect.vue'
import UiBanner from '../../components/ui/UiBanner.vue'
import UiButton from '../../components/ui/UiButton.vue'
import UiEmptyState from '../../components/ui/UiEmptyState.vue'
import { useAdminVenueContext } from '../../composables/adminVenue'
import { VENUE_ADMIN_NAV } from '../../router/venueAdminNav'
import type { AdminNavItem } from '../../utils/adminNav'

const { venues, loaded, error, venueId, load, select } = useAdminVenueContext()
// P2-1c 裁决第 6 节第 9 条：扫码签到页不显示场馆选择器（取自路由 meta，不按地址字符串判断）。
const route = useRoute()
const showVenueSelect = computed(() => route.matched.at(-1)?.meta.hideVenueSelect !== true)

// 每个导航链接都带着当前所选场馆，跳转后保持。
const items = computed<AdminNavItem[]>(() => VENUE_ADMIN_NAV.map((entry) => ({
  label: entry.label,
  icon: entry.icon,
  to: venueId.value === null ? entry.path : { path: entry.path, query: { venueId: String(venueId.value) } },
})))

onMounted(load)
</script>

<template>
  <AdminShell
    brand="场馆管理端"
    :items="items"
  >
    <template #toolbar>
      <AdminVenueSelect
        v-if="loaded && showVenueSelect"
        :venues="venues"
        :venue-id="venueId"
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
      v-else-if="loaded && venueId === null"
      title="暂无授权场馆"
      description="当前账号没有可管理的场馆，请联系系统管理员。"
    />
    <RouterView
      v-else-if="venueId !== null"
      :key="venueId"
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
