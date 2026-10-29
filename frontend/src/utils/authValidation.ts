// docs/12 第 5.1 节：用户名 3–32 位字母数字下划线，密码 8–64 位；v1.3 手机号为 11 位中国大陆手机号。
// 这里只做提交前的体验层提示，裁决在服务端。
const USERNAME_PATTERN = /^\w{3,32}$/
const PASSWORD_MIN = 8
const PASSWORD_MAX = 64
const MOBILE_PATTERN = /^1\d{10}$/

export const PHONE_FORMAT_TEXT = '请输入 11 位手机号'

// 手机号发送前去掉首尾空白（SEC-2c 答复第 6 条），所以这里按去掉首尾空白后的值判断。
export function isMobile(phone: string): boolean {
  return MOBILE_PATTERN.test(phone.trim())
}

function passwordLengthProblem(password: string): string | null {
  return password.length < PASSWORD_MIN || password.length > PASSWORD_MAX ? `密码需为 ${PASSWORD_MIN}–${PASSWORD_MAX} 位` : null
}

export interface ResetFields {
  username: string
  displayName: string
  phone: string
  newPassword: string
  confirmPassword: string
}

// v1.3 找回密码（docs/12 第 5.1 节 POST /auth/password-reset）：用户名、姓名非空白，11 位手机号，新密码规则同注册，两次一致。
export function validateResetFields(fields: ResetFields): string | null {
  if (fields.username.trim() === '') {
    return '请输入用户名'
  }
  if (fields.displayName.trim() === '') {
    return '请填写姓名'
  }
  if (!isMobile(fields.phone)) {
    return PHONE_FORMAT_TEXT
  }
  const passwordProblem = passwordLengthProblem(fields.newPassword)
  if (passwordProblem !== null) {
    return passwordProblem
  }
  return fields.newPassword === fields.confirmPassword ? null : '两次输入的新密码不一致'
}

export interface RegisterFields {
  username: string
  password: string
  displayName: string
}

export function validateLoginFields(username: string, password: string): string | null {
  if (username.trim() === '') {
    return '请输入用户名'
  }
  if (password === '') {
    return '请输入密码'
  }
  return null
}

export function validateRegisterFields(fields: RegisterFields): string | null {
  if (!USERNAME_PATTERN.test(fields.username)) {
    return '用户名需为 3–32 位字母、数字或下划线'
  }
  const passwordProblem = passwordLengthProblem(fields.password)
  if (passwordProblem !== null) {
    return passwordProblem
  }
  if (fields.displayName.trim() === '') {
    return '请填写姓名'
  }
  return null
}
