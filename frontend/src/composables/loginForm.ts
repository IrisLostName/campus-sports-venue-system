// 登录/注册表单的状态与提交流程（docs/12 第 5.1 节）。页面只绑定这里返回的状态与方法。
// 成功后按角色跳转：redirect 只在属于该角色时采用，否则进入该角色入口（docs/02 第 3.1 节）。
import { computed, ref } from 'vue'
import { useRouter, type Router } from 'vue-router'

import type { RegisterRequest } from '../api/requests'
import type { UserType } from '../api/types'
import { resolvePostLoginTarget } from '../router/access'
import { useAuthStore, type AuthResult } from '../stores/auth'
import { validateLoginFields, validateRegisterFields } from '../utils/authValidation'

export type FormMode = 'login' | 'register'

export interface LoginFormAuth {
  login(request: { username: string; password: string }): Promise<AuthResult>
  register(request: RegisterRequest): Promise<AuthResult>
}

export interface LoginFormDeps {
  auth: LoginFormAuth
  router: Router
}

export function createLoginForm(deps: LoginFormDeps) {
  const mode = ref<FormMode>('login')
  const username = ref('')
  const password = ref('')
  const displayName = ref('')
  const userType = ref<UserType | ''>('')
  const phone = ref('')
  const error = ref<string | null>(null)
  const busy = ref(false)
  const isRegister = computed(() => mode.value === 'register')

  function switchMode(next: FormMode): void {
    mode.value = next
    error.value = null
  }

  function buildRegisterRequest(): RegisterRequest {
    const request: RegisterRequest = {
      username: username.value, password: password.value, displayName: displayName.value.trim(),
    }
    if (userType.value !== '') {
      request.userType = userType.value
    }
    if (phone.value.trim() !== '') {
      request.phone = phone.value.trim()
    }
    return request
  }

  function validate(): string | null {
    if (isRegister.value) {
      return validateRegisterFields({
        username: username.value, password: password.value, displayName: displayName.value,
      })
    }
    return validateLoginFields(username.value, password.value)
  }

  function submitRequest(): Promise<AuthResult> {
    if (isRegister.value) {
      return deps.auth.register(buildRegisterRequest())
    }
    return deps.auth.login({ username: username.value.trim(), password: password.value })
  }

  // 登录与注册成功后的流程相同。
  async function submit(): Promise<void> {
    if (busy.value) {
      return
    }
    error.value = validate()
    if (error.value !== null) {
      return
    }
    busy.value = true
    try {
      const result = await submitRequest()
      if (result.ok) {
        const target = resolvePostLoginTarget(result.user.role, deps.router.currentRoute.value.query.redirect)
        await deps.router.replace(target)
      } else {
        error.value = result.message
      }
    } finally {
      busy.value = false
    }
  }

  return { mode, username, password, displayName, userType, phone, error, busy, isRegister, switchMode, submit }
}

export function useLoginForm() {
  const auth = useAuthStore()
  return { auth, ...createLoginForm({ auth, router: useRouter() }) }
}
