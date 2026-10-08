// ACC-M2-09：大屏只读、无写按钮、不含个人信息（FE-7-rulings D1、T4）。
import { readdirSync, readFileSync } from 'node:fs'
import { effectScope } from 'vue'
import { describe, expect, it } from 'vitest'

import type { ApiClient } from '../../src/api/client'
import { useDisplayBoard } from '../../src/composables/displayPolling'
import { buildDisplayBoardView } from '../../src/utils/displayModel'
import { book, createHarness, TOMORROW } from '../api/support/harness'
import { createManualScheduler, settle } from './support'

// 把 ApiClient 换成记录调用的代理：任何方法被调用都会登记其名称。
function recordCalls(client: ApiClient): { client: ApiClient; calls: string[] } {
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

describe('只调用 getDisplaySummary', () => {
  it('进入页面、多轮轮询、失败重试期间，ApiClient 上只出现 getDisplaySummary 的调用', async () => {
    const h = createHarness()
    h.logout()
    const { client, calls } = recordCalls(h.api)
    const scheduler = createManualScheduler()
    effectScope().run(() => useDisplayBoard({ fetchSummary: () => client.getDisplaySummary(), scheduler }))
    for (let round = 0; round < 3; round += 1) {
      await settle()
      scheduler.tick()
    }
    await settle()
    expect(calls).toEqual(['getDisplaySummary', 'getDisplaySummary', 'getDisplaySummary', 'getDisplaySummary'])
  })

  it('未登录（无令牌）即可取到数据：公开接口', async () => {
    const h = createHarness()
    h.logout()
    const summary = await h.api.getDisplaySummary()
    expect(summary.venues.length).toBeGreaterThan(0)
  })
})

const VIEW_DIR = new URL('../../src/views/display/', import.meta.url)
const COMPONENT_DIR = new URL('../../src/components/display/', import.meta.url)

function sources(): { name: string; text: string }[] {
  return [VIEW_DIR, COMPONENT_DIR].flatMap((dir) =>
    readdirSync(dir).filter((name) => name.endsWith('.vue'))
      .map((name) => ({ name, text: readFileSync(new URL(name, dir), 'utf8') })))
}

describe('视图与组件的静态检查（不能挂载组件，此处核对源码）', () => {
  it('没有按钮、表单、输入框、链接，也没有点击或提交事件', () => {
    const forbidden = /<(button|form|input|select|textarea|a)[\s>]|@click|@submit|v-model|v-on:/
    for (const { name, text } of sources()) {
      expect(forbidden.test(text), `${name} 含有可交互元素`).toBe(false)
    }
  })

  it('页面代码里对 api 的调用只有 getDisplaySummary，且不使用 callApi / session / auth store', () => {
    const calls = sources().flatMap(({ text }) => [...text.matchAll(/\bapi\.(\w+)/g)].map((match) => match[1]))
    expect(calls).toEqual(['getDisplaySummary'])
    const pollingSource = readFileSync(new URL('../../src/composables/displayPolling.ts', import.meta.url), 'utf8')
    for (const { name, text } of [...sources(), { name: 'displayPolling.ts', text: pollingSource }]) {
      const code = text.split('\n').filter((line) => !line.trimStart().startsWith('//')).join('\n')
      expect(/callApi|useSession|handleAuthFailure|useAuthStore|stores\/auth/.test(code), `${name} 引用了登录相关逻辑`).toBe(false)
    }
  })
})

const PERSONAL_KEYS = ['userId', 'userDisplayName', 'displayName', 'username', 'userName', 'phone', 'realName', 'email']

function allKeys(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap(allKeys)
  }
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value).flatMap(([key, child]) => [key, ...allKeys(child)])
  }
  return []
}

describe('不含个人信息', () => {
  it('预约、签到之后，接口数据与页面数据中没有个人信息字段，也没有任何用户的用户名或姓名', async () => {
    const h = createHarness()
    await h.loginAs('wangwu')
    await book(h.api, 3, TOMORROW, '08:00')
    await h.loginAs('sysadmin')
    const users = await h.api.adminListUsers({ pageSize: 100 })
    h.logout()
    const summary = await h.api.getDisplaySummary()
    const view = buildDisplayBoardView(summary)
    for (const data of [summary, view]) {
      expect(allKeys(data).filter((key) => PERSONAL_KEYS.includes(key))).toEqual([])
      const text = JSON.stringify(data)
      for (const user of users.items) {
        expect(text.includes(user.username), `数据中出现用户名 ${user.username}`).toBe(false)
        expect(text.includes(user.displayName), `数据中出现姓名 ${user.displayName}`).toBe(false)
      }
    }
    expect(users.items.length).toBeGreaterThan(5)
  })
})
