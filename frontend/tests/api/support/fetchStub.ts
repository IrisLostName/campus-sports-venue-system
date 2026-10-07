// 替身 fetch：记录请求并按预设返回响应，不发起任何真实网络请求。
export interface RecordedCall {
  url: string
  method: string
  headers: Record<string, string>
  body: string | undefined
}

export type StubReply = { status: number; json?: unknown; text?: string } | { failure: Error }

export interface FetchStub {
  fetchImpl: typeof fetch
  calls: RecordedCall[]
}

function toRecordedCall(input: RequestInfo | URL, init: RequestInit | undefined): RecordedCall {
  const headers = (init?.headers ?? {}) as Record<string, string>
  return {
    url: String(input),
    method: init?.method ?? 'GET',
    headers,
    body: typeof init?.body === 'string' ? init.body : undefined,
  }
}

function toResponse(reply: { status: number; json?: unknown; text?: string }): Response {
  const noBody = reply.status === 204 || (reply.json === undefined && reply.text === undefined)
  const text = reply.text ?? (reply.json === undefined ? '' : JSON.stringify(reply.json))
  return new Response(noBody ? null : text, { status: reply.status })
}

export function createFetchStub(reply: StubReply | ((call: RecordedCall) => StubReply)): FetchStub {
  const calls: RecordedCall[] = []
  const fetchImpl: typeof fetch = async (input, init) => {
    const call = toRecordedCall(input, init)
    calls.push(call)
    const current = typeof reply === 'function' ? reply(call) : reply
    if ('failure' in current) {
      throw current.failure
    }
    return toResponse(current)
  }
  return { fetchImpl, calls }
}
