// 用户端 Dock：固定四项，顺序固定（docs/08 第 5 节；docs/01 第 4.1 节）。管理端不作为第五项。
import { PATHS } from './paths'

export interface DockItem {
  label: string
  path: string
}

export const DOCK_ITEMS: readonly DockItem[] = [
  { label: '首页', path: PATHS.home },
  { label: '预约', path: PATHS.reservation },
  { label: '订场', path: PATHS.booking },
  { label: '我的', path: PATHS.me },
]
