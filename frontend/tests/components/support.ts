// 组件测试脚手架：沿用 FE-2 认证脚手架的 Pinia + 内存路由 + mock ApiClient（注入时钟），再把它们装进被挂载的组件。
// 页面里的 useAuthStore() 与脚手架的 store 同为 id 'auth'，Pinia 会返回同一个实例，所以页面用的就是脚手架里已登录（或已恢复失败）的 store。
import { mount, type VueWrapper } from '@vue/test-utils'
import type { Component } from 'vue'
import type { Router } from 'vue-router'

import type { AuthStore } from '../../src/stores/auth'

export interface MountContext {
  auth: AuthStore
  router: Router
}

// 挂载到脚手架 store 所属的那一个 Pinia 上（_p），页面里的 useAuthStore() 因此取到脚手架的 store。
export function mountWithApp(component: Component, context: MountContext): VueWrapper {
  return mount(component, { global: { plugins: [context.auth._p, context.router] } })
}

export function texts(wrapper: VueWrapper, selector: string): string[] {
  return wrapper.findAll(selector).map((node) => node.text())
}

// 找到文字完全等于 text 的按钮（找不到时抛错，测试里不会静默通过）。
export function buttonByText(wrapper: VueWrapper, text: string) {
  const button = wrapper.findAll('button').find((node) => node.text() === text)
  if (button === undefined) {
    throw new Error(`找不到按钮“${text}”，现有按钮：${texts(wrapper, 'button').join('、')}`)
  }
  return button
}
