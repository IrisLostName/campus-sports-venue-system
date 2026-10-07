<script setup lang="ts">
import { useSession } from '../composables/session'

const session = useSession()
</script>

<template>
  <button
    type="button"
    class="logout"
    @click="session.logout()"
  >
    退出登录
  </button>
</template>

<style scoped>
.logout {
  padding: 10px 20px;
  border: 1px solid #c8d0da;
  border-radius: 8px;
  background: #ffffff;
  color: #1f2933;
  font-size: 15px;
  cursor: pointer;
}

.logout:hover {
  background: #f1f4f8;
}
</style>
