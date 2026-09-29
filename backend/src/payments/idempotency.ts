import { createHash } from 'node:crypto'
import type { PaymentRequest, PaymentResponse } from './snailPay.js'

export type IdempotentPaymentResult = {
  statusCode: number
  response: PaymentResponse
}

type IdempotencyEntry = {
  fingerprint: string
  result: Promise<IdempotentPaymentResult>
}

export type IdempotencyOperation =
  | { kind: 'new' | 'replay'; result: Promise<IdempotentPaymentResult> }
  | { kind: 'conflict' }

const idempotencyKeyPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const operations = new Map<string, IdempotencyEntry>()

export function isIdempotencyKey(value: string | undefined): value is string {
  return value !== undefined && idempotencyKeyPattern.test(value)
}

export function paymentFingerprint(request: PaymentRequest): string {
  const canonicalRequest = JSON.stringify({
    cardNumber: request.cardNumber,
    expiry: request.expiry,
    cvv: request.cvv,
    fullName: request.fullName.trim(),
    amount: request.amount,
    payerId: request.payerId,
    payerEmail: request.payerEmail,
  })
  return createHash('sha256').update(canonicalRequest).digest('hex')
}

export function getIdempotencyOperation(
  key: string,
  request: PaymentRequest,
  execute: () => Promise<IdempotentPaymentResult>,
): IdempotencyOperation {
  const fingerprint = paymentFingerprint(request)
  const existing = operations.get(key)
  if (existing) {
    return existing.fingerprint === fingerprint
      ? { kind: 'replay', result: existing.result }
      : { kind: 'conflict' }
  }

  const result = Promise.resolve().then(execute)
  const entry = { fingerprint, result }
  operations.set(key, entry)
  result.catch(() => {
    if (operations.get(key) === entry) operations.delete(key)
  })
  return { kind: 'new', result }
}
