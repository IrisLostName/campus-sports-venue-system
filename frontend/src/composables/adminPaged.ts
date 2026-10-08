// 分页列表的公共部分（FE-5 P2、P6、P7、P8）：当前页条目、页码、总数，以及经 ApiCaller 的加载。
import { ref, shallowRef } from 'vue'

import type { Page } from '../api/types'
import { createAdminRunner } from './adminRunner'
import type { ApiCaller } from './session'

export function createPagedList<T>(call: ApiCaller, fetchPage: (page: number) => Promise<Page<T>>) {
  const runner = createAdminRunner(call)
  const items = shallowRef<T[]>([])
  const page = ref(1)
  const pageSize = ref(20)
  const total = ref(0)
  const loaded = ref(false)

  // 页码与总数都取接口返回值。失败时保留上一次的内容，错误显示在 error。
  async function load(target: number = page.value): Promise<void> {
    const result = await runner.run(() => fetchPage(target))
    if (result.ok) {
      items.value = result.value.items
      page.value = result.value.page
      pageSize.value = result.value.pageSize
      total.value = result.value.total
      loaded.value = true
    }
  }

  return { items, page, pageSize, total, loaded, busy: runner.busy, error: runner.error, load }
}

export type PagedList<T> = ReturnType<typeof createPagedList<T>>
