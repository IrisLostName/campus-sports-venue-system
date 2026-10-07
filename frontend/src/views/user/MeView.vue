<script setup lang="ts">
import LogoutButton from '../../components/LogoutButton.vue'
import PagePlaceholder from '../../components/PagePlaceholder.vue'
import { useAuthStore } from '../../stores/auth'

const auth = useAuthStore()
</script>

<template>
  <PagePlaceholder
    title="我的"
    note="由 FE-4 实现"
  >
    <p v-if="auth.user">
      当前账号：{{ auth.user.displayName }}（{{ auth.user.username }}）
    </p>
    <LogoutButton />
  </PagePlaceholder>
</template>
