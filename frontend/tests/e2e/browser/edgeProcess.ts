// 无头 Edge 进程（BE-8 W2，沿用 FE-8 的做法）：临时用户目录 + 远程调试端口；结束时结束整个进程树并删除临时目录。
import { spawn, spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

import { CdpSession } from './cdpSession'

export interface EdgeHandle {
  page: CdpSession
  close(): Promise<void>
}

interface TargetInfo {
  type: string
  webSocketDebuggerUrl: string
}

const STARTUP_TIMEOUT_MS = 20000

async function pageTarget(port: number): Promise<TargetInfo> {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS
  for (;;) {
    try {
      const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json() as TargetInfo[]
      const page = targets.find((target) => target.type === 'page')
      if (page) {
        return page
      }
    } catch {
      // 浏览器尚未开始监听调试端口，稍后重试。
    }
    if (Date.now() > deadline) {
      throw new Error(`Edge 在 ${STARTUP_TIMEOUT_MS} ms 内没有打开调试端口 ${port}`)
    }
    await delay(250)
  }
}

export async function launchEdge(edgePath: string, port: number): Promise<EdgeHandle> {
  const profile = mkdtempSync(join(tmpdir(), 'be8-edge-'))
  const child = spawn(edgePath, [
    '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--hide-scrollbars', 'about:blank',
  ], { stdio: 'ignore' })
  const page = await CdpSession.connect((await pageTarget(port)).webSocketDebuggerUrl)
  return {
    page,
    async close() {
      page.close()
      if (child.pid !== undefined) {
        spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
      }
      await delay(500)
      rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
    },
  }
}
