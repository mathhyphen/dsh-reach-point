/** Host API for the dsh-reach-point Web plugin. */
export const name = 'dsh-reach-point'
export const inject = ['webServer', 'sessions']

export const USERS_PATH = '/plugins/dsh-reach-point/api/users'

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
}

/** Convert DSH message content blocks into one displayable text value. */
export function extractText(blocks) {
  if (!Array.isArray(blocks)) return ''
  const parts = []
  for (const block of blocks) {
    if (block?.type === 'text' && typeof block.text === 'string') parts.push(block.text)
    else if (block?.type === 'image') parts.push('[图片]')
  }
  return parts.join('\n').trim()
}

/** Select genuine user messages from a session event log. */
export function collectUsers(events) {
  const users = []
  if (!events || typeof events[Symbol.iterator] !== 'function') return users
  for (const event of events) {
    if (event?.type !== 'user/message') continue
    const messages = Array.isArray(event.data) ? event.data : [event.data]
    for (const message of messages) {
      if (!message || typeof message !== 'object') continue
      if (message.role !== 'user' || message.source?.kind !== 'user') continue
      const text = extractText(message.content)
      if (text) users.push({ id: message.id, seq: event.seq, time: event.time, text })
    }
  }
  return users
}

function send(res, status, body, headers = JSON_HEADERS) {
  res.writeHead(status, headers)
  res.end(JSON.stringify(body))
}

/** Build the HTTP handler separately so it is easy to test without Cordis. */
export function createUsersHandler(sessions) {
  return async (req, res) => {
    if (req.method && req.method !== 'GET') {
      send(res, 405, { users: [] }, { ...JSON_HEADERS, allow: 'GET' })
      return
    }

    let url
    try {
      if (typeof req.url !== 'string' || !req.url.startsWith('/')) throw new TypeError('invalid URL')
      url = new URL(req.url, 'http://localhost')
    } catch {
      send(res, 400, { users: [] })
      return
    }

    try {
      const sessionId = url.searchParams.get('sessionId') ?? ''
      const session = sessionId ? sessions.get(sessionId) : undefined
      send(res, 200, { users: session ? collectUsers(session.events) : [] })
    } catch {
      // Do not expose implementation details to the browser.
      send(res, 500, { users: [] })
    }
  }
}

export function apply(ctx) {
  const handler = createUsersHandler(ctx.sessions)
  ctx.effect(
    () => ctx.webServer.register({ kind: 'exact', path: USERS_PATH, handler }),
    'dsh-reach-point: users route',
  )
}
