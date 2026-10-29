<script setup lang="ts">
// 找回密码（SEC-2c；docs/12 第 5.1 节 v1.3、docs/10 第 4a 节）：观感同登录页（docs/17 用户端），一次提交五项。
// 规则说明用 UiTextField 的 hint 显示在输入框下方并与之关联；常驻提示说明次数限制与“没有登记手机号”的去处。
import UiBanner from '../components/ui/UiBanner.vue'
import UiButton from '../components/ui/UiButton.vue'
import UiGlassCard from '../components/ui/UiGlassCard.vue'
import UiTextField from '../components/ui/UiTextField.vue'
import { usePasswordResetForm } from '../composables/passwordResetForm'
import { PATHS } from '../router/paths'
import { DISPLAY_NAME_MAX_LENGTH, MOBILE_LENGTH, PASSWORD_MAX_LENGTH, USERNAME_MAX_LENGTH } from '../utils/fieldLimits'
import { RESET_HINTS } from '../utils/passwordResetDisplay'

const form = usePasswordResetForm()
</script>

<template>
  <main class="reset-page">
    <UiGlassCard
      tag="form"
      class="card"
      :padding="6"
      radius="2xl"
      material="thick"
      novalidate
      @submit.prevent="form.submit()"
    >
      <header class="title-block">
        <h1>找回密码</h1>
        <p class="sub">
          核对账号信息后可直接设置新密码
        </p>
      </header>

      <UiTextField
        v-model="form.username.value"
        label="用户名（学号）"
        type="text"
        autocomplete="username"
        autocapitalize="off"
        :maxlength="USERNAME_MAX_LENGTH"
      />
      <UiTextField
        v-model="form.displayName.value"
        label="姓名"
        type="text"
        autocomplete="name"
        hint="注册时填写的姓名"
        :maxlength="DISPLAY_NAME_MAX_LENGTH"
      />
      <UiTextField
        v-model="form.phone.value"
        label="手机号"
        type="tel"
        inputmode="numeric"
        autocomplete="tel"
        hint="注册时填写的 11 位手机号"
        :maxlength="MOBILE_LENGTH"
      />
      <UiTextField
        v-model="form.newPassword.value"
        label="新密码"
        type="password"
        autocomplete="new-password"
        hint="8–64 位"
        :maxlength="PASSWORD_MAX_LENGTH"
      />
      <UiTextField
        v-model="form.confirmPassword.value"
        label="再输入一次"
        type="password"
        autocomplete="new-password"
        :maxlength="PASSWORD_MAX_LENGTH"
      />

      <ul class="hints">
        <li
          v-for="hint in RESET_HINTS"
          :key="hint"
        >
          {{ hint }}
        </li>
      </ul>

      <UiBanner
        v-if="form.error.value"
        tone="danger"
        role="alert"
      >
        {{ form.error.value }}
      </UiBanner>

      <UiButton
        type="submit"
        block
        :loading="form.busy.value"
      >
        重置密码
      </UiButton>
      <UiButton
        variant="plain"
        class="back"
        :to="PATHS.login"
      >
        返回登录
      </UiButton>
    </UiGlassCard>
  </main>
</template>

<style scoped>
.reset-page {
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

.title-block {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  text-align: center;
}

h1 {
  font: var(--font-title);
}

.sub,
.hints {
  font: var(--font-footnote);
  color: var(--color-text-secondary);
}

.hints {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  padding-left: var(--space-4);
  list-style: disc;
}

.back {
  align-self: center;
}
</style>
