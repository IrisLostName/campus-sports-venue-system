// 首页问候语（UI-4 裁决第 1 节第 1 条）：按业务时区 Asia/Shanghai 的钟点分四段。
// now 为场馆本地时间戳 YYYY-MM-DDTHH:mm:ss（与 nowShanghai() 同格式），与浏览器所在时区无关。
export const WELCOME_LINE = '欢迎使用校园场馆预约与服务管理系统'

export function greetingFor(now: string): string {
  const hour = Number(now.slice('YYYY-MM-DDT'.length, 'YYYY-MM-DDTHH'.length))
  if (hour < 11) {
    return '上午好'
  }
  if (hour < 13) {
    return '中午好'
  }
  return hour < 18 ? '下午好' : '晚上好'
}

// 没有显示姓名（例如登录信息尚未取得）时只显示问候语。
export function greetingLine(now: string, displayName: string | null | undefined): string {
  const greeting = greetingFor(now)
  return displayName === null || displayName === undefined || displayName === '' ? greeting : `${greeting}，${displayName}`
}
