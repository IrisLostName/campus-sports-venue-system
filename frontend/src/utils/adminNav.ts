// 管理端外壳的导航项（FE-5 S1）：由调用方传入，FE-6 传入另一组。
import type { RouteLocationRaw } from 'vue-router'

export interface AdminNavItem {
  label: string
  to: RouteLocationRaw
  group?: string       // 可选：相邻且同组的导航项共用一个分组标题（FE-6 S2）；不填则无标题
}
