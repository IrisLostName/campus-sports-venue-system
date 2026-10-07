<script setup lang="ts">
import { PATHS } from '../../router/paths'
</script>

<template>
  <section class="empty">
    <p>你还没有预约</p>
    <RouterLink :to="PATHS.booking">
      去订场
    </RouterLink>
  </section>
</template>

<style scoped>
.empty {
  padding: 28px 16px;
  border: 1px dashed #c8d0da;
  border-radius: 12px;
  background: #ffffff;
  color: #5f6b7a;
  text-align: center;
}

p {
  margin: 0 0 12px;
  font-size: 16px;
}

a {
  display: inline-block;
  min-height: 44px;
  padding: 10px 28px;
  border-radius: 8px;
  background: #0b6b4f;
  color: #ffffff;
  text-decoration: none;
}
</style>
