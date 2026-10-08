// 组件测试脚手架：沿用 FE-2 认证脚手架的 Pinia + 内存路由 + mock ApiClient（注入时钟），再把它们装进被挂载的组件。
// 页面里的 useAuthStore() 与脚手架的 store 同为 id 'auth'，Pinia 会返回同一个实例，所以页面用的就是脚手架里已登录（或已恢复失败）的 store。
import { mount, type VueWrapper } from '@vue/test-utils'
import { getActivePinia } from 'pinia'
import type { Component } from 'vue'
import type { Router } from 'vue-router'

import type { AuthStore } from '../../src/stores/auth'

export interface MountContext {
  auth: AuthStore
  router: Router
}

// 脚手架在创建（或 reload）时会让它的 Pinia 成为当前 Pinia，所以要在创建/reload 之后、创建下一个脚手架之前挂载；
// 这里核对当前 Pinia 里的 auth store 确实是脚手架的那一个，否则直接报错而不是悄悄用错状态。
export function mountWithApp(component: Component, context: MountContext): VueWrapper {
  const pinia = getActivePinia()
  if (pinia === undefined || pinia._s.get(context.auth.$id) !== context.auth) {
    throw new Error('当前 Pinia 不属于这个脚手架：请在创建或 reload 之后立即挂载')
  }
  return mount(component, { global: { plugins: [pinia, context.router] } })
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
