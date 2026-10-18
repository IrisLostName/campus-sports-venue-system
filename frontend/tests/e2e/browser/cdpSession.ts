// 最小 CDP 客户端（BE-8 W2，无新依赖）：Node 22 全局 WebSocket，发送命令并按 id 等待结果，按方法名订阅事件。
export type CdpParams = Record<string, unknown>

interface Pending {
  method: string
  resolve(result: unknown): void
  reject(error: Error): void
}

interface CdpMessage {
  id?: number
  method?: string
  params?: CdpParams
  result?: unknown
  error?: { message: string }
}

export class CdpSession {
  private nextId = 1
  private readonly pending = new Map<number, Pending>()
  private readonly listeners = new Map<string, Set<(params: CdpParams) => void>>()

  private constructor(private readonly socket: WebSocket) {
    socket.addEventListener('message', (event) => this.dispatch(String(event.data)))
    socket.addEventListener('close', () => this.failAll(new Error('CDP 连接已关闭')))
  }

  static connect(url: string): Promise<CdpSession> {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(url)
      socket.addEventListener('open', () => resolve(new CdpSession(socket)), { once: true })
      socket.addEventListener('error', () => reject(new Error(`无法连接 CDP：${url}`)), { once: true })
    })
  }

  send<T = CdpParams>(method: string, params: CdpParams = {}): Promise<T> {
    const id = this.nextId++
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, { method, resolve: (result) => resolve(result as T), reject })
      this.socket.send(JSON.stringify({ id, method, params }))
    })
  }

  on(method: string, listener: (params: CdpParams) => void): () => void {
    const set = this.listeners.get(method) ?? new Set()
    set.add(listener)
    this.listeners.set(method, set)
    return () => set.delete(listener)
  }

  close(): void {
    this.socket.close()
  }

  private dispatch(raw: string): void {
    const message = JSON.parse(raw) as CdpMessage
    if (message.id !== undefined) {
      const pending = this.pending.get(message.id)
      this.pending.delete(message.id)
      if (message.error) {
        pending?.reject(new Error(`${pending.method}：${message.error.message}`))
      } else {
        pending?.resolve(message.result)
      }
      return
    }
    for (const listener of this.listeners.get(message.method ?? '') ?? []) {
      listener(message.params ?? {})
    }
  }

  private failAll(error: Error): void {
    for (const pending of this.pending.values()) {
      pending.reject(error)
    }
    this.pending.clear()
  }
}
