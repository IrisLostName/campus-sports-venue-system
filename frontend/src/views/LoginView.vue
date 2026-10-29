<script setup lang="ts">
import UiBanner from '../components/ui/UiBanner.vue'
import UiButton from '../components/ui/UiButton.vue'
import UiGlassCard from '../components/ui/UiGlassCard.vue'
import UiSegmented from '../components/ui/UiSegmented.vue'
import UiTextField from '../components/ui/UiTextField.vue'
import { useLoginForm } from '../composables/loginForm'
import { PATHS } from '../router/paths'
import { MOBILE_LENGTH } from '../utils/fieldLimits'

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
      <UiBanner
        v-if="form.auth.success"
        class="notice"
        tone="success"
        role="status"
      >
        {{ form.auth.success }}
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
      <!-- SEC-2c：只在登录模式显示找回密码入口；样式块保持不变（userSurfaceUnchanged），靠右用行内样式。 -->
      <UiButton
        v-if="!form.isRegister.value"
        style="align-self: flex-end"
        variant="plain"
        :to="PATHS.passwordReset"
      >
        忘记密码？
      </UiButton>

      <template v-if="form.isRegister.value">
        <UiTextField
          v-model="form.displayName.value"
          label="姓名"
          type="text"
          autocomplete="name"
        />
        <!-- v1.3：手机号必填；“身份”放在表单最下方（SEC-2c 裁决已定事项第 4 条）。 -->
        <UiTextField
          v-model="form.phone.value"
          label="手机号"
          type="tel"
          inputmode="numeric"
          autocomplete="tel"
          hint="11 位手机号，可用于找回密码"
          :maxlength="MOBILE_LENGTH"
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
