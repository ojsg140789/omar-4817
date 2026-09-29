import { randomUUID } from 'node:crypto'
import type { Server } from 'node:http'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
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

async function postPayment(body: object, key?: string) {
  return fetch(`${baseUrl}/api/payments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(key ? { 'Idempotency-Key': key } : {}),
    },
    body: JSON.stringify(body),
  })
}

describe('POST /api/payments e idempotencia', () => {
  it('rechaza la ausencia o el formato inválido de Idempotency-Key', async () => {
    await expect(postPayment(validBody)).resolves.toMatchObject({ status: 400 })
    await expect(postPayment(validBody, 'clave-invalida')).resolves.toMatchObject({ status: 400 })
  })

  it('reproduce por HTTP exactamente la misma respuesta para la misma operación', async () => {
    const key = randomUUID()
    const first = await postPayment(validBody, key)
    const firstBody = await first.json()
    const replay = await postPayment(validBody, key)

    expect(first.status).toBe(200)
    expect(replay.status).toBe(200)
    await expect(replay.json()).resolves.toEqual(firstBody)
  })

  it('responde 409 cuando la misma clave se reutiliza con otro payload', async () => {
    const key = randomUUID()
    await postPayment(validBody, key)
    const conflict = await postPayment({ ...validBody, amount: 100.51 }, key)

    expect(conflict.status).toBe(409)
    await expect(conflict.json()).resolves.toMatchObject({ status: 'error' })
  })
})
