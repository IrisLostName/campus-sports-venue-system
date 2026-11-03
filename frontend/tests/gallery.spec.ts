// UI-6 首页图集的纯函数：打乱顺序、图片地址、替代文字。
import { describe, expect, it } from 'vitest'

import { galleryAlt, galleryUrl, shuffle } from '../src/utils/gallery'

// 可复现的伪随机数（mulberry32）。
function seeded(seed: number): () => number {
  let state = seed
  return () => {
    state = (state + 0x6d2b79f5) | 0
    let t = Math.imul(state ^ (state >>> 15), 1 | state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

describe('shuffle', () => {
  const files = ['1.jpg', '2.jpg', '3.jpg', '4.jpg', '5.jpg', '6.jpg', '7.jpg', '8.jpg', '9.jpg']

  it('结果是原列表的一个排列：每个文件恰好出现一次，原数组不变', () => {
    for (let seed = 1; seed <= 200; seed += 1) {
      const result = shuffle(files, seeded(seed))
      expect(result).toHaveLength(files.length)
      expect([...result].sort()).toEqual(files)
    }
    expect(files[0]).toBe('1.jpg')
  })

  it('不同的随机数得到不同的顺序', () => {
    const orders = new Set(Array.from({ length: 50 }, (_, seed) => shuffle(files, seeded(seed + 1)).join(',')))
    expect(orders.size).toBeGreaterThan(1)
  })

  it('空列表与单张不出错', () => {
    expect(shuffle([])).toEqual([])
    expect(shuffle(['a.jpg'])).toEqual(['a.jpg'])
  })
})

describe('galleryUrl / galleryAlt', () => {
  it('拼在 BASE_URL 下的 media/gallery/，文件名做 URL 编码', () => {
    expect(galleryUrl('1.jpg', '/')).toBe('/media/gallery/1.jpg')
    expect(galleryUrl('a b.jpg', '/app')).toBe('/app/media/gallery/a%20b.jpg')
  })

  it('替代文字：场馆图集 第 n 张，共 N 张', () => {
    expect(galleryAlt(0, 9)).toBe('场馆图集 第 1 张，共 9 张')
    expect(galleryAlt(8, 9)).toBe('场馆图集 第 9 张，共 9 张')
  })
})
