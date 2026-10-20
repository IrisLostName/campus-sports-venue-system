// TEST-2 页面走查（ACC-M4-02）的上下文：沿用 BE-8 的走查上下文（无头 Edge、页面驱动、接口记录），另加
// 页面脚本异常的收集与 capture()：每张截图前先断言页面文字、等待接口空闲、做布局测量并写日志，测量不合格即失败。
// 截图文件名：ACC-M4-02-<序号>-<表面>-<页面>[-<状态>]-<宽>x<高>-<light|dark>.png（TEST-2 裁决第 6 节）。
import { expect } from 'vitest'

import {
  layoutProbe, panelProbe, targetProbe, type LayoutReport, type PanelReport, type TargetReport,
} from '../browser/pageScripts'
import { closeWalk, openWalk, type Walk } from '../walkthrough/session'

export const SHOT_PREFIX = 'ACC-M4-02-'
const MIN_TARGET_PX = 44
const MIN_FONT_PX = 12

export type Surface = 'login' | 'user' | 'admin' | 'display'
export type Theme = 'light' | 'dark'

export interface Tour extends Walk {
  pageErrors: string[]
}

export interface CaptureOptions {
  surface: Surface
  heading?: string              // 页面上必须有文字完全相同的 <h1>（管理端：导航项名同时出现在侧栏里，只看文字不够）
  expect: string[]              // 截图前页面上必须出现的文字
  absent?: string[]             // 截图前页面上不得出现的文字
  themes?: Theme[]              // 缺省只拍浅色；大屏固定深色
  scrolledBottom?: boolean      // 用户端：先把内容区滚到底再拍
}

export async function openTour(): Promise<Tour> {
  const walk = await openWalk()
  const pageErrors: string[] = []
  walk.edge.page.on('Runtime.exceptionThrown', (params) => {
    const details = params.exceptionDetails as { text?: string; exception?: { description?: string } }
    pageErrors.push(details.exception?.description ?? details.text ?? 'exception')
  })
  walk.edge.page.on('Runtime.consoleAPICalled', (params) => {
    if (params.type === 'error') {
      pageErrors.push(JSON.stringify(params.args))
    }
  })
  return Object.assign(walk, { pageErrors })
}

export async function closeTour(tour: Tour | undefined): Promise<void> {
  tour?.record('page-errors', tour.pageErrors)
  await closeWalk(tour)
}

async function assertTexts(tour: Tour, options: CaptureOptions): Promise<void> {
  if (options.heading !== undefined) {
    const heading = JSON.stringify(options.heading)
    await tour.page.waitFor(`[...document.querySelectorAll('h1')].some((h) => h.innerText.trim() === ${heading})`, `标题 ${heading}`)
  }
  for (const text of options.expect) {
    await tour.page.waitForText(text)
  }
  const body = await tour.page.text()
  for (const text of options.absent ?? []) {
    expect(body, `页面不应出现「${text}」`).not.toContain(text)
  }
}

interface Measures {
  layout: LayoutReport
  targets: TargetReport
  panels: PanelReport | null
}

async function measure(tour: Tour, surface: Surface): Promise<Measures> {
  const run = <T>(fn: (args: never) => T, args: unknown = {}) => tour.page.evaluate<T>(`(${fn.toString()})(${JSON.stringify(args)})`)
  const layout = await run<LayoutReport>(layoutProbe)
  const targets = await run<TargetReport>(targetProbe, { minSize: MIN_TARGET_PX })
  const panels = surface === 'display' ? await run<PanelReport>(panelProbe, { selector: 'main.display .ui-glass-card' }) : null
  return { layout, targets, panels }
}

// 不合格即失败；只记录不判定的：管理端（桌面）小于 44 px 的可点击元素。
function judge(name: string, surface: Surface, { layout, targets, panels }: Measures): void {
  expect([layout.pageOverflowX <= 0, layout.contentOverflowX <= 0], `${name} 横向溢出`).toEqual([true, true])
  expect(targets.overlaps, `${name} 可点击元素互相重叠`).toEqual([])
  if (surface === 'user' || surface === 'login') {
    expect(targets.small, `${name} 小于 ${MIN_TARGET_PX} px 的可点击元素`).toEqual([])
  }
  if (surface === 'user') {
    expect(layout.dockTop, `${name} 没有 Dock`).not.toBeNull()
    expect(layout.lastBottom ?? 0, `${name} 滚到底时最后一项被 Dock 压住`).toBeLessThanOrEqual(layout.dockTop ?? 0)
  }
  if (surface === 'display' && panels !== null) {
    expect(targets.count, `${name} 大屏出现可交互元素`).toBe(0)
    expect(layout.minFontPx, `${name} 最小字号`).toBeGreaterThanOrEqual(MIN_FONT_PX)
    expect(panels.overlaps, `${name} 面板重叠`).toEqual([])
    expect([panels.scrollX, panels.scrollY], `${name} 出现滚动条`).toEqual([0, 0])
  }
}

async function scrollContentToBottom(tour: Tour): Promise<void> {
  await tour.page.evaluate('(() => { const c = document.querySelector("main.content"); c.scrollTop = c.scrollHeight })()')
}

export async function capture(tour: Tour, name: string, options: CaptureOptions): Promise<void> {
  const themes = options.themes ?? [options.surface === 'display' ? 'dark' : 'light']
  for (const theme of themes) {
    if (options.surface !== 'display') {
      await tour.page.setTheme(theme)
    }
    await assertTexts(tour, options)
    await tour.page.waitIdle()
    const measures = await measure(tour, options.surface)
    judge(`${name}（${theme}）`, options.surface, measures)
    if (options.scrolledBottom === true) {
      await scrollContentToBottom(tour)
    }
    const file = await tour.page.screenshot(name, theme, SHOT_PREFIX)
    tour.shots.push(file)
    tour.record('shot', { file, surface: options.surface, expect: options.expect, ...measures })
  }
  await tour.page.setTheme('light')
}
