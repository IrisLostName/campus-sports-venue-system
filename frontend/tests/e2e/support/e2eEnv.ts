// BE-8 联调的环境变量与默认值（本机分离部署：后端 127.0.0.1:8080，vite preview 127.0.0.1:4173）。
// 后端与前端地址只接受回环地址：联调会写数据，绝不能指向演示服务器。
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

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
  // 截图直接写入 docs/evidence/screenshots（BE-8 裁决 W1）；接口响应要点写入日志目录供证据文件引用。
  shotDir: process.env.E2E_SHOT_DIR || fileURLToPath(new URL('../../../../docs/evidence/screenshots/', import.meta.url)),
  logDir: process.env.E2E_LOG_DIR || join(tmpdir(), 'be8-e2e-log'),
}
