// 组件测试用：把 api/index 导出的 api 换成“测试此刻指定的客户端”。
// 各测试文件用 vi.mock 把 src/api/index 的 api 导出替换为 swappedApi()，页面、store、组合函数拿到的就都是它。
import type { ApiClient } from '../../src/api/client'

const slot: { current: ApiClient | null } = { current: null }

export function useApiClient(client: ApiClient): void {
  slot.current = client
}

// 每次访问成员时才取当前客户端，所以 store 在模块加载时捕获的 api 也会跟着换。
export function swappedApi(): ApiClient {
  return new Proxy({} as ApiClient, {
    get(_target, key) {
      const client = slot.current
      if (client === null) {
        throw new Error('测试没有先调用 useApiClient 指定客户端')
      }
      const member: unknown = Reflect.get(client, key)
      return typeof member === 'function' ? (...args: unknown[]) => Reflect.apply(member, client, args) : member
    },
  })
}

// 包一层记录调用：任何方法被调用都登记其名称。
export function recordCalls(client: ApiClient): { client: ApiClient; calls: string[] } {
  const calls: string[] = []
  const proxy = new Proxy(client, {
    get(target, key, receiver) {
      const member: unknown = Reflect.get(target, key, receiver)
      if (typeof member !== 'function' || typeof key !== 'string') {
        return member
      }
      return (...args: unknown[]) => {
        calls.push(key)
        return Reflect.apply(member, target, args)
      }
    },
  })
  return { client: proxy, calls }
}
