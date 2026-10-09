<script setup lang="ts">
// 公告表（FE-5 P6）：场馆公告可归档（canArchive），系统公告只读，因此同一个组件用于两张表。
import type { AnnouncementRowView } from '../../../utils/announcementDisplay'
import UiButton from '../../ui/UiButton.vue'
import AdminDataTable from '../AdminDataTable.vue'

defineProps<{ rows: AnnouncementRowView[]; caption: string; emptyTitle: string }>()

defineEmits<{ archive: [id: number] }>()

const COLUMNS = [
  { key: 'title', label: '标题' },
  { key: 'content', label: '内容' },
  { key: 'status', label: '状态' },
  { key: 'publishedText', label: '发布时间' },
  { key: 'publishedByName', label: '发布人' },
  { key: 'expiresText', label: '过期时间' },
  { key: 'actions', label: '操作' },
]
</script>

<template>
  <AdminDataTable
    :columns="COLUMNS"
    :rows="rows"
    row-key="id"
    :caption="caption"
    :empty-title="emptyTitle"
  >
    <template #cell-status="{ row }">
      {{ row.statusLabel }}
    </template>
    <template #cell-actions="{ row }">
      <UiButton
        v-if="row.canArchive"
        variant="secondary"
        @click="$emit('archive', row.id)"
      >
        归档
      </UiButton>
    </template>
  </AdminDataTable>
</template>
