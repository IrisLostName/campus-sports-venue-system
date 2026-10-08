<script setup lang="ts">
defineProps<{ title: string; note: string }>()
</script>

<template>
  <section
    class="placeholder"
    data-surface="admin"
  >
    <h1>{{ title }}</h1>
    <p>{{ note }}</p>
    <slot />
  </section>
</template>

<style scoped>
.placeholder {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-6) var(--space-4);
}

h1 {
  font: var(--font-title);
}

p {
  color: var(--color-text-secondary);
}
</style>
