<script setup lang="ts">
defineProps<{ title: string; note: string }>()
</script>

<template>
  <section class="placeholder">
    <h1>{{ title }}</h1>
    <p>{{ note }}</p>
    <slot />
  </section>
</template>

<style scoped>
.placeholder {
  padding: 24px 16px;
}

h1 {
  margin: 0 0 8px;
  font-size: 22px;
}

p {
  margin: 0 0 16px;
  color: #5f6b7a;
}
</style>
