<script setup lang="ts">
import { useRoute } from 'vue-router'

import { DOCK_ITEMS } from '../router/dock'

const route = useRoute()

function isActive(path: string): boolean {
  return path === '/' ? route.path === '/' : route.path === path || route.path.startsWith(`${path}/`)
}
</script>

<template>
  <nav
    class="dock"
    aria-label="主导航"
  >
    <RouterLink
      v-for="item in DOCK_ITEMS"
      :key="item.path"
      :to="item.path"
      class="dock-item"
      :class="{ active: isActive(item.path) }"
    >
      {{ item.label }}
    </RouterLink>
  </nav>
</template>

<style scoped>
.dock {
  display: flex;
  flex: none;
  border-top: 1px solid #dde3ea;
  background: #ffffff;
  padding-bottom: env(safe-area-inset-bottom);
}

.dock-item {
  flex: 1;
  padding: 14px 0;
  color: #5f6b7a;
  font-size: 15px;
  text-align: center;
  text-decoration: none;
}

.dock-item.active {
  color: #0b6b4f;
  font-weight: 600;
  box-shadow: inset 0 3px 0 #0b6b4f;
}
</style>
