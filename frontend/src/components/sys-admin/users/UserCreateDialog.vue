<script setup lang="ts">
// 新建账号（FE-6 G2、G3；docs/12 第 5.1、5.9 节）：用户名 3–32 位字母数字下划线，密码 8–64 位，与注册一致。
// 密码框 type="password"、autocomplete="new-password"，页面不显示、不回显密码。
// 规则说明用 UiTextField 的 hint 显示在输入框下方（docs/17 第 2 节：第三级文字不得用于需要阅读的文字，所以不用占位符），并与输入框关联。
// 角色为场馆管理员时才出现“授权场馆”，为普通用户时才出现“用户类型”。
import type { CreateUserState } from '../../../composables/sysUsers'
import type { Role, VenueSummary } from '../../../api/types'
import {
  DISPLAY_NAME_MAX_LENGTH, PASSWORD_MAX_LENGTH, PHONE_MAX_LENGTH, USERNAME_MAX_LENGTH,
} from '../../../utils/fieldLimits'
import { ROLE_OPTIONS, USER_TYPE_OPTIONS } from '../../../utils/sysUserDisplay'
import AdminActionDialog from '../../admin/AdminActionDialog.vue'
import UiTextField from '../../ui/UiTextField.vue'
import VenueCheckList from './VenueCheckList.vue'

defineProps<{ state: CreateUserState | null; venues: readonly VenueSummary[]; fixedRole?: Role }>()

defineEmits<{ patch: [change: Partial<CreateUserState>]; confirm: []; dismiss: [] }>()
</script>

<template>
  <AdminActionDialog
    :open="state !== null"
    title="新建账号"
    confirm-label="创建"
    :busy="state?.busy ?? false"
    :error="state?.error ?? null"
    @confirm="$emit('confirm')"
    @dismiss="$emit('dismiss')"
  >
    <UiTextField
      :model-value="state?.username ?? ''"
      label="用户名"
      autocomplete="off"
      hint="3–32 位字母、数字或下划线"
      :maxlength="USERNAME_MAX_LENGTH"
      @update:model-value="$emit('patch', { username: $event })"
    />
    <UiTextField
      :model-value="state?.password ?? ''"
      label="密码"
      type="password"
      autocomplete="new-password"
      hint="8–64 位"
      :maxlength="PASSWORD_MAX_LENGTH"
      @update:model-value="$emit('patch', { password: $event })"
    />
    <UiTextField
      :model-value="state?.displayName ?? ''"
      label="显示名"
      :maxlength="DISPLAY_NAME_MAX_LENGTH"
      @update:model-value="$emit('patch', { displayName: $event })"
    />
    <UiTextField
      v-if="fixedRole === undefined"
      :model-value="state?.role ?? 'USER'"
      label="角色"
      control="select"
      @update:model-value="$emit('patch', { role: $event as Role })"
    >
      <option
        v-for="option in ROLE_OPTIONS"
        :key="option.value"
        :value="option.value"
      >
        {{ option.label }}
      </option>
    </UiTextField>
    <UiTextField
      v-if="state?.role === 'USER'"
      :model-value="state.userType"
      label="用户类型"
      control="select"
      @update:model-value="$emit('patch', { userType: $event as CreateUserState['userType'] })"
    >
      <option
        v-for="option in USER_TYPE_OPTIONS"
        :key="option.value"
        :value="option.value"
      >
        {{ option.label }}
      </option>
    </UiTextField>
    <UiTextField
      :model-value="state?.phone ?? ''"
      label="手机号（可选）"
      :maxlength="PHONE_MAX_LENGTH"
      @update:model-value="$emit('patch', { phone: $event })"
    />
    <VenueCheckList
      v-if="state?.role === 'VENUE_ADMIN'"
      :model-value="state.venueIds"
      :venues="venues"
      legend="授权场馆"
      @update:model-value="$emit('patch', { venueIds: $event })"
    />
  </AdminActionDialog>
</template>
