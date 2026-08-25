import test from 'node:test'
import assert from 'node:assert/strict'
import { collectUsers, createUsersHandler, extractText } from '../index.js'

function response() {
  return {
    status: undefined,
    headers: undefined,
    body: undefined,
    writeHead(status, headers) { this.status = status; this.headers = headers },
    end(body) { this.body = JSON.parse(body) },
  }
}

test('extractText joins text blocks and represents images', () => {
  assert.equal(extractText([{ type: 'text', text: 'one' }, { type: 'image' }, { type: 'text', text: 'two' }]), 'one\n[图片]\ntwo')
  assert.equal(extractText([{ type: 'image' }]), '[图片]')
  assert.equal(extractText([]), '')
})

test('collectUsers keeps only real user messages', () => {
  const users = collectUsers([
    { type: 'user/message', seq: 2, time: 9, data: { id: 'a', role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: 'Hi' }] } },
    { type: 'user/message', seq: 3, time: 10, data: { id: 'b', role: 'user', source: { kind: 'tool' }, content: [{ type: 'text', text: 'Skip' }] } },
    { type: 'agent/message', seq: 4, time: 11, data: { id: 'c', role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: 'Skip' }] } },
  ])
  assert.deepEqual(users, [{ id: 'a', seq: 2, time: 9, text: 'Hi' }])
})

test('collectUsers accepts event.data arrays', () => {
  assert.deepEqual(collectUsers([{
    type: 'user/message', seq: 5, time: 12, data: [
      { id: 'image', role: 'user', source: { kind: 'user' }, content: [{ type: 'image' }] },
      { id: 'empty', role: 'user', source: { kind: 'user' }, content: [] },
    ],
  }]), [{ id: 'image', seq: 5, time: 12, text: '[图片]' }])
})

test('handler reports method, URL, unknown session and internal failures safely', async () => {
  const handler = createUsersHandler({
    get(id) {
      if (id === 'known') return { events: [] }
      if (id === 'broken') throw new Error('private details')
      return undefined
    },
  })
  let res = response(); await handler({ method: 'POST', url: '/plugins/dsh-reach-point/api/users' }, res)
  assert.equal(res.status, 405); assert.equal(res.headers.allow, 'GET')
  res = response(); await handler({ method: 'GET', url: 'not-a-path' }, res)
  assert.equal(res.status, 400)
  res = response(); await handler({ method: 'GET', url: '/plugins/dsh-reach-point/api/users?sessionId=missing' }, res)
  assert.deepEqual(res.body, { users: [] })
  res = response(); await handler({ method: 'GET', url: '/plugins/dsh-reach-point/api/users?sessionId=broken' }, res)
  assert.equal(res.status, 500); assert.deepEqual(res.body, { users: [] })
})
