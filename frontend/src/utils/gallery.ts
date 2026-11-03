// 首页图集（UI-6）的纯函数：打乱顺序、拼图片地址、替代文字。

// Fisher–Yates，返回新数组，不改原数组；rng 可注入，便于测试。
export function shuffle<T>(list: readonly T[], rng: () => number = Math.random): T[] {
  const result = [...list]
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    const picked = result[j] as T
    result[j] = result[i] as T
    result[i] = picked
  }
  return result
}

export function galleryUrl(name: string, base: string = import.meta.env.BASE_URL): string {
  const root = base.endsWith('/') ? base : `${base}/`
  return `${root}media/gallery/${encodeURIComponent(name)}`
}

export function galleryAlt(index: number, total: number): string {
  return `场馆图集 第 ${index + 1} 张，共 ${total} 张`
}
