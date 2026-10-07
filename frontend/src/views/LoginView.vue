<script setup lang="ts">
import { useLoginForm } from '../composables/loginForm'

const form = useLoginForm()
</script>

<template>
  <main class="login-page">
    <form
      class="card"
      novalidate
      @submit.prevent="form.submit()"
    >
      <h1>校园场馆预约系统</h1>

      <div
        class="tabs"
        role="tablist"
      >
        <button
          type="button"
          role="tab"
          :aria-selected="!form.isRegister.value"
          :class="{ on: !form.isRegister.value }"
          @click="form.switchMode('login')"
        >
          登录
        </button>
        <button
          type="button"
          role="tab"
          :aria-selected="form.isRegister.value"
          :class="{ on: form.isRegister.value }"
          @click="form.switchMode('register')"
        >
          注册
        </button>
      </div>

      <p
        v-if="form.auth.notice"
        class="notice"
        role="status"
      >
        {{ form.auth.notice }}
      </p>

      <label>
        用户名
        <input
          v-model="form.username.value"
          type="text"
          autocomplete="username"
          autocapitalize="off"
        >
      </label>
      <label>
        密码
        <input
          v-model="form.password.value"
          type="password"
          :autocomplete="form.isRegister.value ? 'new-password' : 'current-password'"
        >
      </label>

      <template v-if="form.isRegister.value">
        <label>
          姓名
          <input
            v-model="form.displayName.value"
            type="text"
            autocomplete="name"
          >
        </label>
        <label>
          身份（选填）
          <select v-model="form.userType.value">
            <option value="">不填写</option>
            <option value="STUDENT">学生</option>
            <option value="TEACHER">教师</option>
            <option value="OTHER">其他</option>
          </select>
        </label>
        <label>
          手机号（选填）
          <input
            v-model="form.phone.value"
            type="tel"
            autocomplete="tel"
          >
        </label>
      </template>

      <p
        v-if="form.error.value"
        class="error"
        role="alert"
      >
        {{ form.error.value }}
      </p>

      <button
        type="submit"
        class="submit"
        :disabled="form.busy.value"
      >
        {{ form.isRegister.value ? '注册并登录' : '登录' }}
      </button>
    </form>
  </main>
</template>

<style scoped>
.login-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 16px;
  background: #e8ecf1;
}

.card {
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: 100%;
  max-width: 380px;
  padding: 28px 24px;
  border-radius: 12px;
  background: #ffffff;
  box-shadow: 0 4px 20px rgb(31 41 51 / 10%);
}

h1 {
  margin: 0;
  font-size: 20px;
  text-align: center;
}

.tabs {
  display: flex;
  border-bottom: 1px solid #dde3ea;
}

.tabs button {
  flex: 1;
  padding: 10px 0;
  border: 0;
  border-bottom: 3px solid transparent;
  background: none;
  color: #5f6b7a;
  font-size: 15px;
  cursor: pointer;
}

.tabs button.on {
  border-bottom-color: #0b6b4f;
  color: #0b6b4f;
  font-weight: 600;
}

label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: #3e4c59;
  font-size: 14px;
}

input,
select {
  padding: 10px 12px;
  border: 1px solid #c8d0da;
  border-radius: 8px;
  font-size: 16px;
}

.notice {
  margin: 0;
  padding: 10px 12px;
  border-radius: 8px;
  background: #fff7e0;
  color: #7a5a00;
  font-size: 14px;
}

.error {
  margin: 0;
  color: #b42318;
  font-size: 14px;
}

.submit {
  padding: 12px;
  border: 0;
  border-radius: 8px;
  background: #0b6b4f;
  color: #ffffff;
  font-size: 16px;
  cursor: pointer;
}

.submit:disabled {
  opacity: 0.6;
  cursor: default;
}
</style>
