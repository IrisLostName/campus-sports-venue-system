<script setup lang="ts">
// 调整场馆管理员的授权范围（FE-6 G2）：多选场馆，保存时整体替换（docs/12 第 5.9 节）。
import type { VenueSummary } from '../../../api/types'
import type { ScopeState } from '../../../composables/sysUserScope'
import AdminActionDialog from '../../admin/AdminActionDialog.vue'
import VenueCheckList from './VenueCheckList.vue'

defineProps<{ state: ScopeState | null; venues: readonly VenueSummary[] }>()

defineEmits<{ patch: [change: Partial<ScopeState>]; confirm: []; dismiss: [] }>()
</script>

<template>
  <AdminActionDialog
    :open="state !== null"
    title="调整授权范围"
    confirm-label="保存"
    :busy="state?.busy ?? false"
    :error="state?.error ?? null"
    @confirm="$emit('confirm')"
    @dismiss="$emit('dismiss')"
  >
    <p class="summary">
      {{ state?.name }}
    </p>
    <VenueCheckList
      :model-value="state?.venueIds ?? []"
      :venues="venues"
      legend="授权场馆（保存时整体替换，不选表示不授权任何场馆）"
      @update:model-value="$emit('patch', { venueIds: $event })"
    />
  </AdminActionDialog>
</template>

<style scoped>
.summary {
  color: var(--color-text-secondary);
}
</style>
