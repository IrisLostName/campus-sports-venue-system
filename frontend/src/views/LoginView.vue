<script setup lang="ts">
import UiBanner from '../components/ui/UiBanner.vue'
import UiButton from '../components/ui/UiButton.vue'
import UiGlassCard from '../components/ui/UiGlassCard.vue'
import UiSegmented from '../components/ui/UiSegmented.vue'
import UiTextField from '../components/ui/UiTextField.vue'
import { useLoginForm } from '../composables/loginForm'

const form = useLoginForm()

const MODE_ITEMS = [
  { value: 'login', label: '登录' },
  { value: 'register', label: '注册' },
]

function onModeChange(value: string | null): void {
  form.switchMode(value === 'register' ? 'register' : 'login')
}
</script>

<template>
  <main class="login-page">
    <UiGlassCard
      tag="form"
      class="card"
      :padding="6"
      radius="2xl"
      material="thick"
      novalidate
      @submit.prevent="form.submit()"
    >
      <h1>校园场馆预约与服务管理系统</h1>

      <UiSegmented
        :items="MODE_ITEMS"
        :model-value="form.mode.value"
        label="登录方式"
        mode="tabs"
        @update:model-value="onModeChange"
      />

      <UiBanner
        v-if="form.auth.notice"
        class="notice"
        tone="warning"
        role="status"
      >
        {{ form.auth.notice }}
      </UiBanner>

      <UiTextField
        v-model="form.username.value"
        label="用户名"
        type="text"
        autocomplete="username"
        autocapitalize="off"
      />
      <UiTextField
        v-model="form.password.value"
        label="密码"
        type="password"
        :autocomplete="form.isRegister.value ? 'new-password' : 'current-password'"
      />

      <template v-if="form.isRegister.value">
        <UiTextField
          v-model="form.displayName.value"
          label="姓名"
          type="text"
          autocomplete="name"
        />
        <UiTextField
          v-model="form.userType.value"
          label="身份（选填）"
          control="select"
        >
          <option value="">
            不填写
          </option>
          <option value="STUDENT">
            学生
          </option>
          <option value="TEACHER">
            教师
          </option>
          <option value="OTHER">
            其他
          </option>
        </UiTextField>
        <UiTextField
          v-model="form.phone.value"
          label="手机号（选填）"
          type="tel"
          autocomplete="tel"
        />
      </template>

      <UiBanner
        v-if="form.error.value"
        class="error"
        tone="danger"
        role="alert"
      >
        {{ form.error.value }}
      </UiBanner>

      <UiButton
        type="submit"
        class="submit"
        block
        :loading="form.busy.value"
      >
        {{ form.isRegister.value ? '注册并登录' : '登录' }}
      </UiButton>
    </UiGlassCard>
  </main>
</template>

<style scoped>
.login-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  min-height: 100dvh;
  padding: var(--space-4);
}

.card {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  width: 100%;
  max-width: 400px;
}

h1 {
  font: var(--font-title);
  text-align: center;
}
</style>
