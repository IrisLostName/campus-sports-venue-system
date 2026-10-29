// 找回密码表单的状态与提交流程（docs/12 第 5.1 节 POST /auth/password-reset，v1.3；SEC-2c）。页面只绑定这里返回的状态与方法。
// 公开接口，不经 callApi：没有登录状态可失效。成功后回到登录页，留下成功提示并预填用户名（不预填密码）。
import { ref } from 'vue'
import { useRouter, type Router } from 'vue-router'

import { api } from '../api/index'
import type { PasswordResetRequest } from '../api/requests'
import { PATHS } from '../router/paths'
import { useAuthStore } from '../stores/auth'
import { validateResetFields } from '../utils/authValidation'
import { RESET_SUCCESS_NOTICE, resetErrorText } from '../utils/passwordResetDisplay'

export interface PasswordResetFormDeps {
  resetPassword(request: PasswordResetRequest): Promise<void>
  done(username: string, message: string): void
  router: Router
}

export function createPasswordResetForm(deps: PasswordResetFormDeps) {
  const username = ref('')
  const displayName = ref('')
  const phone = ref('')
  const newPassword = ref('')
  const confirmPassword = ref('')
  const error = ref<string | null>(null)
  const busy = ref(false)

  // 用户名、姓名、手机号去掉首尾空白后发送（与登录、注册一致）；密码原样发送。
  function buildRequest(): PasswordResetRequest {
    return {
      username: username.value.trim(),
      displayName: displayName.value.trim(),
      phone: phone.value.trim(),
      newPassword: newPassword.value,
    }
  }

  async function submit(): Promise<void> {
    if (busy.value) {
      return
    }
    error.value = validateResetFields({
      username: username.value, displayName: displayName.value, phone: phone.value,
      newPassword: newPassword.value, confirmPassword: confirmPassword.value,
    })
    if (error.value !== null) {
      return
    }
    busy.value = true
    const request = buildRequest()
    try {
      await deps.resetPassword(request)
      deps.done(request.username, RESET_SUCCESS_NOTICE)
      await deps.router.replace(PATHS.login)
    } catch (cause) {
      error.value = resetErrorText(cause)
    } finally {
      busy.value = false
    }
  }

  return { username, displayName, phone, newPassword, confirmPassword, error, busy, submit }
}

export function usePasswordResetForm() {
  const auth = useAuthStore()
  return createPasswordResetForm({
    resetPassword: (request) => api.resetPassword(request),
    done: (name, message) => auth.passwordResetDone(name, message),
    router: useRouter(),
  })
}
