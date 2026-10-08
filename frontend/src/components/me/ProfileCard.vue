<script setup lang="ts">
import type { ProfileView } from '../../utils/meDisplay'
import UiGlassCard from '../ui/UiGlassCard.vue'

defineProps<{ profile: ProfileView }>()
</script>

<template>
  <UiGlassCard
    tag="section"
    class="profile"
    aria-label="用户资料"
  >
    <h2>{{ profile.displayName }}</h2>
    <dl class="rows">
      <div>
        <dt>用户名</dt>
        <dd>{{ profile.username }}</dd>
      </div>
      <div>
        <dt>身份</dt>
        <dd>{{ profile.userTypeText }}</dd>
      </div>
      <div>
        <dt>手机号</dt>
        <dd>{{ profile.phoneText }}</dd>
      </div>
    </dl>
    <slot />
  </UiGlassCard>
</template>

<style scoped>
.profile {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--space-3);
}

h2 {
  font: var(--font-title);
}

.rows {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  width: 100%;
}

.rows div {
  display: flex;
  gap: var(--space-3);
  font: var(--font-callout);
}

dt {
  flex: none;
  width: 4em;
  color: var(--color-text-secondary);
}

dd {
  min-width: 0;
  overflow-wrap: anywhere;
}
</style>
