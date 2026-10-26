// 运营大屏的主题偏好（UI-2a-rulings 第 2 节）：默认浅色，切换后记在该屏幕浏览器的本地存储里，不随系统深浅色变化。
// 存储不可用（隐私模式、被禁用、读写抛错）时照常可用：读不到按浅色，写不进只影响下次打开。
// 这是 auth store 之外唯一允许使用本地存储的文件（scripts/check-code.mjs，UI-2a 计划闸门第 1 条批准）。
import { ref, type Ref } from 'vue'

export type DisplayTheme = 'light' | 'dark'

export const DISPLAY_THEME_KEY = 'campus-venue.display-theme'

export interface ThemeStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

function browserStorage(): ThemeStorage | null {
  try {
    return globalThis.localStorage ?? null
  } catch {
    return null
  }
}

export function readDisplayTheme(storage: ThemeStorage | null = browserStorage()): DisplayTheme {
  try {
    return storage?.getItem(DISPLAY_THEME_KEY) === 'dark' ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

export function writeDisplayTheme(theme: DisplayTheme, storage: ThemeStorage | null = browserStorage()): void {
  try {
    storage?.setItem(DISPLAY_THEME_KEY, theme)
  } catch {
    // 写不进存储时只在本次打开期间生效。
  }
}

export interface DisplayThemeState {
  theme: Ref<DisplayTheme>
  toggle(): void
}

export function useDisplayTheme(storage: ThemeStorage | null = browserStorage()): DisplayThemeState {
  const theme = ref<DisplayTheme>(readDisplayTheme(storage))
  function toggle(): void {
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
    writeDisplayTheme(theme.value, storage)
  }
  return { theme, toggle }
}
