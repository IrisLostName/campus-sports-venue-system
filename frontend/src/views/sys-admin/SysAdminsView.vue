<script setup lang="ts">
// 管理员与授权（FE-6 G2，/sys-admin/admins）：场馆管理员账号列表、新建、调整授权范围、停用 / 启用。
import UsersPanel from '../../components/sys-admin/users/UsersPanel.vue'
</script>

<template>
  <UsersPanel
    title="管理员与授权"
    fixed-role="VENUE_ADMIN"
  />
</template>
