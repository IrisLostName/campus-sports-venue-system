// docs/12 第 5.1 节：用户名 3–32 位字母数字下划线，密码 8–64 位。这里只做提交前的体验层提示，裁决在服务端。
const USERNAME_PATTERN = /^\w{3,32}$/
const PASSWORD_MIN = 8
const PASSWORD_MAX = 64

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
  if (fields.password.length < PASSWORD_MIN || fields.password.length > PASSWORD_MAX) {
    return `密码需为 ${PASSWORD_MIN}–${PASSWORD_MAX} 位`
  }
  if (fields.displayName.trim() === '') {
    return '请填写姓名'
  }
  return null
}
