// BE-8 联调的环境变量与默认值（本机分离部署：后端 127.0.0.1:8080，vite preview 127.0.0.1:4173）。
// 后端与前端地址只接受回环地址：联调会写数据，绝不能指向演示服务器。
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

export function loopbackUrl(name: string, fallback: string): string {
  const raw = process.env[name] || fallback
  if (!LOOPBACK_HOSTS.has(new URL(raw).hostname)) {
    throw new Error(`${name} 只能指向本机回环地址，收到：${raw}`)
  }
  return raw.replace(/\/+$/, '')
}

export const E2E = {
  apiBaseUrl: loopbackUrl('E2E_API_BASE_URL', 'http://127.0.0.1:8080'),
  appUrl: loopbackUrl('E2E_APP_URL', 'http://127.0.0.1:4173'),
  edgePath: process.env.E2E_EDGE_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  cdpPort: Number(process.env.E2E_CDP_PORT || '9333'),
  // 截图缺省写入临时目录，复跑不会覆盖已提交的证据（BE-8 审计 N7）；
  // 更新证据时才显式设置 E2E_SHOT_DIR 为仓库根目录下的 docs/evidence/screenshots（BE-8 裁决 W1）。
  shotDir: process.env.E2E_SHOT_DIR || join(tmpdir(), 'be8-e2e-shots'),
  logDir: process.env.E2E_LOG_DIR || join(tmpdir(), 'be8-e2e-log'),
}

// 打开浏览器前打印截图目录，复跑者据此找到截图。
export function announceShotDir(): void {
  const source = process.env.E2E_SHOT_DIR ? 'E2E_SHOT_DIR' : '缺省临时目录'
  process.stdout.write(`[e2e] 截图目录（${source}）：${E2E.shotDir}\n`)
}
