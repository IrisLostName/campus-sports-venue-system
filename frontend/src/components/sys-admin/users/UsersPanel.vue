<script setup lang="ts">
// 账号管理面板（FE-6 G2、G3）：“管理员与授权”（fixedRole=VENUE_ADMIN，显示授权场馆）与“用户”（全部角色）共用。
import { onMounted } from 'vue'

import type { Role } from '../../../api/types'
import { useVenueOptions } from '../../../composables/adminVenue'
import { useSysUsers } from '../../../composables/sysUsers'
import AdminActionDialog from '../../admin/AdminActionDialog.vue'
import AdminPage from '../../admin/AdminPage.vue'
import AdminPagination from '../../admin/AdminPagination.vue'
import UiButton from '../../ui/UiButton.vue'
import ScopeDialog from './ScopeDialog.vue'
import UserCreateDialog from './UserCreateDialog.vue'
import UserFilters from './UserFilters.vue'
import UserRenameDialog from './UserRenameDialog.vue'
import UserTable from './UserTable.vue'

const props = defineProps<{ title: string; fixedRole?: Role }>()

const { venues } = useVenueOptions()
const board = useSysUsers(props.fixedRole)
const { filters, notice, rows, list, error, busy, disable } = board
const { page, pageSize, total, loaded, busy: listBusy } = list

onMounted(board.load)
</script>

<template>
  <AdminPage
    :title="title"
    :error="error"
    :notice="notice"
  >
    <template #actions>
      <UiButton @click="board.openCreate">
        新建账号
      </UiButton>
    </template>
    <UserFilters
      v-model:filters="filters"
      :busy="listBusy"
      :show-role="fixedRole === undefined"
      @search="board.search"
    />
    <template v-if="loaded">
      <UserTable
        :rows="rows"
        :show-scope="fixedRole === 'VENUE_ADMIN'"
        :busy="busy"
        @rename="board.openRename"
        @scope="board.openScope"
        @disable="board.askDisable"
        @enable="board.enable"
      />
      <AdminPagination
        :page="page"
        :page-size="pageSize"
        :total="total"
        :busy="listBusy"
        @change="board.goTo"
      />
    </template>
    <UserCreateDialog
      :state="board.create.value"
      :venues="venues"
      :fixed-role="fixedRole"
      @patch="board.patchCreate"
      @confirm="board.confirmCreate"
      @dismiss="board.dismissCreate"
    />
    <UserRenameDialog
      :state="board.rename.value"
      @patch="board.patchRename"
      @confirm="board.confirmRename"
      @dismiss="board.dismissRename"
    />
    <ScopeDialog
      :state="board.scope.value"
      :venues="venues"
      @patch="board.patchScope"
      @confirm="board.confirmScope"
      @dismiss="board.dismissScope"
    />
    <AdminActionDialog
      :open="disable !== null"
      title="确认停用账号？"
      confirm-label="停用"
      confirm-variant="destructive"
      :busy="disable?.busy ?? false"
      :error="disable?.error ?? null"
      @confirm="board.confirmDisable"
      @dismiss="board.dismissDisable"
    >
      <p>停用后该用户无法登录，已登录的令牌也会失效：{{ disable?.name }}</p>
    </AdminActionDialog>
  </AdminPage>
</template>
