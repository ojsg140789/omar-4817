import { randomUUID } from 'node:crypto'
import type { Server } from 'node:http'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import app from './app.ts'

const validBody = {
  cardNumber: '1234123412341234',
  expiry: '12/26',
  cvv: '543',
  fullName: 'Persona de Prueba',
  amount: 100.5,
  payerId: 'user-test',
  payerEmail: 'test@example.com',
}

let server: Server
let baseUrl = ''
const originalNodeEnv = process.env.NODE_ENV
const originalFrontendOrigin = process.env.FRONTEND_ORIGIN

function restoreEnvironment() {
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV
  else process.env.NODE_ENV = originalNodeEnv
  if (originalFrontendOrigin === undefined) delete process.env.FRONTEND_ORIGIN
  else process.env.FRONTEND_ORIGIN = originalFrontendOrigin
}

beforeAll(async () => {
  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (address && typeof address !== 'string') baseUrl = `http://127.0.0.1:${address.port}`
      resolve()
    })
  })
})

afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
})

afterEach(() => {
  restoreEnvironment()
})

async function postPayment(body: object, key?: string, origin?: string) {
  return fetch(`${baseUrl}/api/payments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(key ? { 'Idempotency-Key': key } : {}),
      ...(origin ? { Origin: origin } : {}),
    },
    body: JSON.stringify(body),
  })
}

async function preflight(origin: string) {
  return fetch(`${baseUrl}/api/payments`, {
    method: 'OPTIONS',
    headers: {
      Origin: origin,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'Content-Type, Idempotency-Key',
    },
  })
}

describe('POST /api/payments e idempotencia', () => {
  it('rejects an absent or invalid Idempotency-Key', async () => {
    await expect(postPayment(validBody)).resolves.toMatchObject({ status: 400 })
    await expect(postPayment(validBody, 'invalid-key')).resolves.toMatchObject({ status: 400 })
  })

  it('replays the exact HTTP response for the same operation', async () => {
    const key = randomUUID()
    const first = await postPayment(validBody, key)
    const firstBody = await first.json()
    const replay = await postPayment(validBody, key)

    expect(first.status).toBe(200)
    expect(replay.status).toBe(200)
    await expect(replay.json()).resolves.toEqual(firstBody)
  })

  it('returns 409 when the same key is reused with another payload', async () => {
    const key = randomUUID()
    await postPayment(validBody, key)
    const conflict = await postPayment({ ...validBody, amount: 100.51 }, key)

    expect(conflict.status).toBe(409)
    await expect(conflict.json()).resolves.toMatchObject({ status: 'error' })
  })
})

describe('CORS', () => {
  it.each([
    'http://localhost:5173',
    'http://127.0.0.1:5173',
  ])('allows the development preflight from %s', async (origin) => {
    process.env.NODE_ENV = 'development'
    delete process.env.FRONTEND_ORIGIN

    const response = await preflight(origin)

    expect(response.status).toBe(204)
    expect(response.headers.get('access-control-allow-origin')).toBe(origin)
    expect(response.headers.get('access-control-allow-methods')).toContain('POST')
    expect(response.headers.get('access-control-allow-headers')?.toLowerCase()).toContain('content-type')
    expect(response.headers.get('access-control-allow-headers')?.toLowerCase()).toContain('idempotency-key')
  })

  it('does not send CORS headers to an unknown development origin', async () => {
    process.env.NODE_ENV = 'development'
    delete process.env.FRONTEND_ORIGIN

    const response = await preflight('https://untrusted.example.com')

    expect(response.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('allows the configured production origin for preflight and POST', async () => {
    const origin = 'https://frontend.example.com'
    process.env.NODE_ENV = 'production'
    process.env.FRONTEND_ORIGIN = origin

    const preflightResponse = await preflight(origin)
    const postResponse = await postPayment(validBody, randomUUID(), origin)

    expect(preflightResponse.status).toBe(204)
    expect(preflightResponse.headers.get('access-control-allow-origin')).toBe(origin)
    expect(postResponse.headers.get('access-control-allow-origin')).toBe(origin)
  })

  it('does not allow another origin in production', async () => {
    process.env.NODE_ENV = 'production'
    process.env.FRONTEND_ORIGIN = 'https://frontend.example.com'

    const response = await preflight('https://other.example.com')

    expect(response.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('does not fall back to localhost without FRONTEND_ORIGIN in production', async () => {
    process.env.NODE_ENV = 'production'
    delete process.env.FRONTEND_ORIGIN

    const response = await preflight('http://localhost:5173')

    expect(response.headers.get('access-control-allow-origin')).toBeNull()
  })
})
