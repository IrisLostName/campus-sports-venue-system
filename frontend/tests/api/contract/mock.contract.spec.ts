// 契约测试套件对 mock 适配器运行。对真实后端的 http 版本属于 BE-8，本包不用替身 fetch 冒充后端。
import { createMockClient } from '../../../src/api/mock/index'
import { createFakeClock, NOW } from '../support/harness'
import { contractSuite, type ContractTarget } from './suite'

function makeMockTarget(): ContractTarget {
  let token: string | null = null
  const api = createMockClient({ clock: createFakeClock(NOW), getToken: () => token })
  return { api, setToken: (value) => { token = value } }
}

contractSuite('mock', makeMockTarget)
