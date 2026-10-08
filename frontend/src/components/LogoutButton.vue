<script setup lang="ts">
import { useSession } from '../composables/session'
import UiButton from './ui/UiButton.vue'

const session = useSession()
</script>

<template>
  <UiButton
    variant="secondary"
    class="logout"
    @click="session.logout()"
  >
    退出登录
  </UiButton>
</template>
