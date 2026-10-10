<script setup lang="ts">
// 用户表（FE-6 G2、G3）：用户名、显示名、角色、账号状态（文字）、授权场馆（showScope 时），以及改名 / 授权 / 停用 / 启用。
// 自己的账号不显示停用按钮（后端仍会以 INVALID_STATE 拒绝）。
import { labelFor } from '../../../utils/accessibleLabel'
import type { UserRowView } from '../../../utils/sysUserDisplay'
import AdminDataTable from '../../admin/AdminDataTable.vue'
import UiButton from '../../ui/UiButton.vue'

const props = defineProps<{ rows: UserRowView[]; showScope: boolean; busy: boolean }>()

defineEmits<{ rename: [id: number]; scope: [id: number]; disable: [id: number]; enable: [id: number] }>()

const BASE_COLUMNS = [
  { key: 'username', label: '用户名' },
  { key: 'displayName', label: '显示名' },
  { key: 'roleLabel', label: '角色' },
  { key: 'statusLabel', label: '账号状态' },
]
const COLUMNS = [
  ...BASE_COLUMNS,
  ...(props.showScope ? [{ key: 'scopeText', label: '授权场馆' }] : []),
  { key: 'ops', label: '操作' },
]
</script>

<template>
  <AdminDataTable
    :columns="COLUMNS"
    :rows="rows"
    row-key="id"
    caption="账号列表"
    empty-title="没有符合条件的账号"
  >
    <template #cell-ops="{ row }">
      <div class="ops">
        <UiButton
          variant="secondary"
          :aria-label="labelFor('改显示名', row.username)"
          @click="$emit('rename', row.id)"
        >
          改显示名
        </UiButton>
        <UiButton
          v-if="row.isVenueAdmin"
          variant="secondary"
          :aria-label="labelFor('调整授权', row.username)"
          @click="$emit('scope', row.id)"
        >
          调整授权
        </UiButton>
        <UiButton
          v-if="row.active && !row.isSelf"
          variant="destructive"
          :disabled="busy"
          :aria-label="labelFor('停用', row.username)"
          @click="$emit('disable', row.id)"
        >
          停用
        </UiButton>
        <UiButton
          v-if="!row.active"
          variant="secondary"
          :disabled="busy"
          :aria-label="labelFor('启用', row.username)"
          @click="$emit('enable', row.id)"
        >
          启用
        </UiButton>
      </div>
    </template>
  </AdminDataTable>
</template>

<style scoped>
.ops {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}
</style>
