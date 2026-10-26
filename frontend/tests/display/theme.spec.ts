// UI-2a-rulings 第 2 节：主题默认浅色，切换后写入本地存储；存储不可用（为 null、读写抛错）时照常可用。
// 挂载整页后的切换与恢复见 tests/components/displayTheme.spec.ts。
import { describe, expect, it } from 'vitest'

import {
  DISPLAY_THEME_KEY, readDisplayTheme, useDisplayTheme, writeDisplayTheme, type ThemeStorage,
} from '../../src/views/display/displayTheme'

function memoryStorage(initial: Record<string, string> = {}): ThemeStorage & { data: Map<string, string> } {
  const data = new Map(Object.entries(initial))
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value)
    },
  }
}

const BROKEN: ThemeStorage = {
  getItem: () => {
    throw new Error('SecurityError')
  },
  setItem: () => {
    throw new Error('QuotaExceededError')
  },
}

describe('读取主题偏好', () => {
  it('键名为 campus-venue.display-theme', () => {
    expect(DISPLAY_THEME_KEY).toBe('campus-venue.display-theme')
  })

  it('没有记录、记录无效、存储为 null、读取抛错：都按浅色', () => {
    expect(readDisplayTheme(memoryStorage())).toBe('light')
    expect(readDisplayTheme(memoryStorage({ [DISPLAY_THEME_KEY]: 'purple' }))).toBe('light')
    expect(readDisplayTheme(null)).toBe('light')
    expect(readDisplayTheme(BROKEN)).toBe('light')
  })

  it('记录为 dark 时读出深色', () => {
    expect(readDisplayTheme(memoryStorage({ [DISPLAY_THEME_KEY]: 'dark' }))).toBe('dark')
  })

  it('node 环境没有 localStorage 时缺省参数也不抛错', () => {
    expect(readDisplayTheme()).toBe('light')
    expect(() => writeDisplayTheme('dark')).not.toThrow()
  })
})

describe('切换与写入', () => {
  it('切换在浅色与深色之间往返，每次都写入存储，换一个实例读回同样的值', () => {
    const storage = memoryStorage()
    const first = useDisplayTheme(storage)
    expect(first.theme.value).toBe('light')
    first.toggle()
    expect(first.theme.value).toBe('dark')
    expect(storage.data.get(DISPLAY_THEME_KEY)).toBe('dark')
    expect(useDisplayTheme(storage).theme.value).toBe('dark')
    first.toggle()
    expect(storage.data.get(DISPLAY_THEME_KEY)).toBe('light')
  })

  it('存储读写都抛错时：缺省浅色，切换照常生效，不抛出异常', () => {
    const state = useDisplayTheme(BROKEN)
    expect(state.theme.value).toBe('light')
    expect(() => state.toggle()).not.toThrow()
    expect(state.theme.value).toBe('dark')
  })
})
