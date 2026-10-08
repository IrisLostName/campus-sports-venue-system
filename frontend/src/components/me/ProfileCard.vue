<script setup lang="ts">
import type { ProfileView } from '../../utils/meDisplay'

defineProps<{ profile: ProfileView }>()
</script>

<template>
  <section
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
  </section>
</template>

<style scoped>
.profile {
  margin-bottom: 20px;
  padding: 14px 16px;
  border: 1px solid #dde3ea;
  border-radius: 12px;
  background: #ffffff;
}

h2 {
  margin: 0 0 8px;
  font-size: 19px;
}

.rows {
  margin: 0 0 12px;
}

.rows div {
  display: flex;
  gap: 12px;
  padding: 4px 0;
  font-size: 15px;
}

dt {
  flex: none;
  width: 4em;
  color: #5f6b7a;
}

dd {
  margin: 0;
  min-width: 0;
  overflow-wrap: anywhere;
}
</style>
