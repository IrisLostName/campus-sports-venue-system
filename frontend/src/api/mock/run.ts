// 把同步的业务函数包装成接口方法：先做时间判定清扫，错误变成 rejected Promise，结果深拷贝后返回，
// 调用方改动返回值不会影响 mock 内部状态。业务函数内部全程同步，“检查 + 写入”之间没有 await。
import type { MockContext } from './state'
import { sweep } from './reservationView'

export function run<T>(ctx: MockContext, action: () => T): Promise<T> {
  try {
    sweep(ctx)
    return Promise.resolve(structuredClone(action()))
  } catch (error) {
    return Promise.reject(error)
  }
}
