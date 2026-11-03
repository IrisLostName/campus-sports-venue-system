// UI-6 首页图集组件：空列表不渲染；一次一张、只渲染当前与下一张；每 5 秒自动换图；减少动态效果时不自动换图、不淡入淡出。
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import HomeGallery from '../../src/components/home/HomeGallery.vue'
import { GALLERY_INTERVAL_MS } from '../../src/composables/homeGallery'

const FILES = ['a.jpg', 'b.png', 'c.webp']

function stubReducedMotion(reduce: boolean): void {
  vi.spyOn(window, 'matchMedia').mockImplementation((query: string) => ({
    matches: reduce && query === '(prefers-reduced-motion: reduce)',
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }))
}

function shown(page: VueWrapper): string {
  return page.find('img.photo:not(.preload)').attributes('src') ?? ''
}

function dots(page: VueWrapper) {
  return page.findAll('button.dot')
}

beforeEach(() => {
  vi.useFakeTimers()
  stubReducedMotion(false)
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('空图集', () => {
  it('没有图片时整个图集不渲染', () => {
    const page = mount(HomeGallery, { props: { images: [] } })
    expect(page.find('.home-gallery').exists()).toBe(false)
    expect(page.find('img').exists()).toBe(false)
  })
})

describe('显示', () => {
  it('是名为“场馆图集”的区域；只渲染当前与下一张；替代文字与指示点', () => {
    const page = mount(HomeGallery, { props: { images: FILES } })
    const region = page.find('.home-gallery')
    expect(region.attributes('role')).toBe('region')
    expect(region.attributes('aria-label')).toBe('场馆图集')
    expect(region.element.tagName).not.toBe('SECTION')

    const images = page.findAll('img')
    expect(images).toHaveLength(2)
    expect(images.every((image) => image.attributes('loading') === 'lazy')).toBe(true)
    expect(page.find('img.photo:not(.preload)').attributes('alt')).toBe('场馆图集 第 1 张，共 3 张')
    expect(page.find('img.preload').attributes('alt')).toBe('')
    expect(shown(page)).not.toBe(page.find('img.preload').attributes('src'))
    expect(FILES.map((name) => `/media/gallery/${name}`)).toContain(shown(page))

    expect(dots(page).map((dot) => dot.attributes('aria-label'))).toEqual(['第 1 张', '第 2 张', '第 3 张'])
    expect(dots(page).map((dot) => dot.attributes('aria-current'))).toEqual(['true', undefined, undefined])
  })

  it('只有一张：没有预加载图、没有指示点、不自动换图', () => {
    const page = mount(HomeGallery, { props: { images: ['only.jpg'] } })
    expect(page.findAll('img')).toHaveLength(1)
    expect(dots(page)).toHaveLength(0)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('样式：固定高度 240px，按比例完整缩放（contain），不裁切', () => {
    const source = readFileSync(resolve('src/components/home/HomeGallery.vue'), 'utf8')
    expect(source).toMatch(/\.frame \{[^}]*height: 240px;/)
    expect(source).toMatch(/\.photo \{[^}]*object-fit: contain;/)
    expect(source).not.toMatch(/object-fit: cover/)
  })
})

describe('自动换图', () => {
  it('每 5 秒换下一张，末尾回到第一张；淡入淡出开启', async () => {
    const page = mount(HomeGallery, { props: { images: FILES } })
    const first = shown(page)
    const nextSrc = page.find('img.preload').attributes('src')

    await vi.advanceTimersByTimeAsync(GALLERY_INTERVAL_MS - 1)
    expect(shown(page)).toBe(first)
    await vi.advanceTimersByTimeAsync(1)
    expect(shown(page)).toBe(nextSrc)
    expect(page.find('img.photo:not(.preload)').attributes('alt')).toBe('场馆图集 第 2 张，共 3 张')

    await vi.advanceTimersByTimeAsync(GALLERY_INTERVAL_MS * 2)
    expect(shown(page)).toBe(first)
    expect(page.find('transition-stub').attributes('css')).toBe('true')
  })

  it('点指示点切换到那一张并重新计时', async () => {
    const page = mount(HomeGallery, { props: { images: FILES } })
    await vi.advanceTimersByTimeAsync(GALLERY_INTERVAL_MS - 1000)
    await dots(page)[2]?.trigger('click')
    expect(page.find('img.photo:not(.preload)').attributes('alt')).toBe('场馆图集 第 3 张，共 3 张')
    expect(dots(page)[2]?.attributes('aria-current')).toBe('true')

    await vi.advanceTimersByTimeAsync(GALLERY_INTERVAL_MS - 1)
    expect(page.find('img.photo:not(.preload)').attributes('alt')).toBe('场馆图集 第 3 张，共 3 张')
    await vi.advanceTimersByTimeAsync(1)
    expect(page.find('img.photo:not(.preload)').attributes('alt')).toBe('场馆图集 第 1 张，共 3 张')
  })

  it('卸载后不再计时', () => {
    const page = mount(HomeGallery, { props: { images: FILES } })
    expect(vi.getTimerCount()).toBe(1)
    page.unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('减少动态效果', () => {
  it('不自动换图、不淡入淡出，指示点仍可切换', async () => {
    stubReducedMotion(true)
    const page = mount(HomeGallery, { props: { images: FILES } })
    const first = shown(page)
    expect(vi.getTimerCount()).toBe(0)
    expect(page.find('transition-stub').attributes('css')).toBe('false')

    await vi.advanceTimersByTimeAsync(GALLERY_INTERVAL_MS * 3)
    expect(shown(page)).toBe(first)

    await dots(page)[1]?.trigger('click')
    expect(page.find('img.photo:not(.preload)').attributes('alt')).toBe('场馆图集 第 2 张，共 3 张')
    expect(vi.getTimerCount()).toBe(0)
  })
})
