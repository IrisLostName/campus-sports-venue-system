// 管理端外壳的导航项（FE-5 S1）：由调用方传入，FE-6 传入另一组。
import type { RouteLocationRaw } from 'vue-router'

export interface AdminNavItem {
  label: string
  to: RouteLocationRaw
}
