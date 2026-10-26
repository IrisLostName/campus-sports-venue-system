// UI-2a-rulings 第 2 节：挂载整页后主题默认浅色；点击切换为深色并写入本地存储，重新挂载后恢复；存储不可用时照常可用。
// 切换与全屏只改变本机显示方式，不调用写接口（计划闸门第 3 条）。
import { afterEach, describe, expect, it, vi } from 'vitest'

import { DISPLAY_THEME_KEY } from '../../src/views/display/displayTheme'
import { makeSummary } from '../display/support'
import { installDisplayEnvironment, installIntervalClock, mountDisplay } from './displaySupport'

vi.mock('../../src/api/index', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/api/index')>()
  const { swappedApi } = await import('./apiSwap')
  return { ...actual, api: swappedApi() }
})

installIntervalClock()
installDisplayEnvironment()

afterEach(() => {
  vi.restoreAllMocks()
})

describe('主题切换与记忆', () => {
  it('默认浅色；切换后为深色并写入存储；重新挂载后仍是深色；再切回浅色', async () => {
    const first = await mountDisplay([makeSummary()])
    const root = () => first.page.get('main.display')
    expect(root().attributes('data-surface')).toBe('display')
    expect(root().attributes('data-display-theme')).toBe('light')
    expect(root().attributes('data-theme')).toBeUndefined()

    await first.page.get('button.theme-toggle').trigger('click')
    expect(root().attributes('data-display-theme')).toBe('dark')
    expect(first.page.get('button.theme-toggle').attributes('aria-label')).toBe('切换为浅色')
    expect(localStorage.getItem(DISPLAY_THEME_KEY)).toBe('dark')
    first.page.unmount()

    const second = await mountDisplay([makeSummary()])
    expect(second.page.get('main.display').attributes('data-display-theme')).toBe('dark')
    await second.page.get('button.theme-toggle').trigger('click')
    expect(second.page.get('main.display').attributes('data-display-theme')).toBe('light')
    expect(localStorage.getItem(DISPLAY_THEME_KEY)).toBe('light')
  })

  it('点击主题与全屏按钮都不调用任何接口（只有进入页面时的一次 getDisplaySummary）', async () => {
    const request = vi.fn(() => Promise.resolve())
    Object.defineProperty(document.documentElement, 'requestFullscreen', { value: request, configurable: true })
    const shown = await mountDisplay([makeSummary()])
    await shown.page.get('button.theme-toggle').trigger('click')
    await shown.page.get('button.fullscreen-toggle').trigger('click')
    expect(request).toHaveBeenCalledTimes(1)
    expect(shown.calls).toEqual(['getDisplaySummary'])
    Reflect.deleteProperty(document.documentElement, 'requestFullscreen')
  })

  it('本地存储读写都抛错：页面按浅色显示，切换照常生效', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    const shown = await mountDisplay([makeSummary()])
    expect(shown.page.get('main.display').attributes('data-display-theme')).toBe('light')
    await shown.page.get('button.theme-toggle').trigger('click')
    expect(shown.page.get('main.display').attributes('data-display-theme')).toBe('dark')
  })
})

describe('全屏按钮', () => {
  it('Fullscreen API 不可用时不显示全屏按钮，主题按钮仍在', async () => {
    Reflect.deleteProperty(document, 'fullscreenEnabled')
    const shown = await mountDisplay([makeSummary()])
    expect(shown.page.find('button.fullscreen-toggle').exists()).toBe(false)
    expect(shown.page.findAll('button').map((button) => button.attributes('aria-label'))).toEqual(['切换为深色'])
  })
})
