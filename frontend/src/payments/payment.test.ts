import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  amountToCents,
  approvedCents,
  parseAmountToCents,
  requestPayment,
  type PaymentResponse,
  type PaymentResponseResult,
} from './payment.ts'

const paymentValues = {
  cardNumber: '1234123412341234',
  expiry: '12/26',
  cvv: '543',
  fullName: 'Persona de Prueba',
  amount: '100.50',
}

function paymentResponse(overrides: Partial<PaymentResponse> = {}): PaymentResponse {
  return {
    id: 'pay_test',
    status: 'approved',
    status_detail: 'Pago aprobado por SnailPay simulado.',
    transaction_amount: 100.5,
    date_created: '2026-01-01T00:00:00.000Z',
    authorization_code: 'auth_test',
    reference: 'ref_test',
    payer_id: 'user-test',
    payer_email: 'test@example.com',
    card_number: '1234123412341234',
    cvv: '543',
    ...overrides,
  }
}

function approvedResult(overrides: Partial<PaymentResponseResult> = {}): PaymentResponseResult {
  return {
    kind: 'approved',
    message: 'Recarga aprobada correctamente.',
    httpOk: true,
    httpStatus: 200,
    payment: paymentResponse(),
    payerId: 'user-test',
    payerEmail: 'test@example.com',
    requestedCents: 10050,
    requestedCardNumber: '1234123412341234',
    requestedCvv: '543',
    ...overrides,
  }
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('conversiones de monto', () => {
  it('convierte formatos de monto válidos a centavos', () => {
    expect(parseAmountToCents('100.50')).toBe(10050)
    expect(parseAmountToCents('7')).toBe(700)
    expect(parseAmountToCents('7.5')).toBe(750)
  })

  it('rechaza formatos de monto que no representan una recarga válida', () => {
    expect(parseAmountToCents('0')).toBeNull()
    expect(parseAmountToCents('-1')).toBeNull()
    expect(parseAmountToCents('1.234')).toBeNull()
    expect(parseAmountToCents('cien')).toBeNull()
  })

  it('convierte números seguros y rechaza importes no representables', () => {
    expect(amountToCents(12.34)).toBe(1234)
    expect(amountToCents(100.5)).toBe(10050)
    expect(amountToCents(0.001)).toBeNull()
    expect(amountToCents(0)).toBeNull()
  })
})

describe('approvedCents', () => {
  it('acredita solo una aprobación completamente coherente', () => {
    expect(approvedCents(approvedResult())).toBe(10050)
  })

  it.each([
    ['rejected', approvedResult({ payment: paymentResponse({ status: 'rejected', authorization_code: null }) })],
    ['HTTP no exitoso', approvedResult({ httpOk: false, httpStatus: 500 })],
    ['payer inconsistente', approvedResult({ payment: paymentResponse({ payer_id: 'other-user' }) })],
    ['monto inconsistente', approvedResult({ payment: paymentResponse({ transaction_amount: 100.51 }) })],
  ])('no acredita una respuesta %s', (_reason, result) => {
    expect(approvedCents(result)).toBeNull()
  })
})

describe('requestPayment', () => {
  it.each([
    ['approved', 200, paymentResponse(), 'approved'],
    ['rejected', 200, paymentResponse({ status: 'rejected', authorization_code: null, status_detail: 'Rechazado.' }), 'rejected'],
    ['invalid-request', 400, paymentResponse({ status: 'error', authorization_code: null, status_detail: 'Solicitud inválida.' }), 'invalid-request'],
    ['system-error', 500, paymentResponse({ status: 'error', authorization_code: null, status_detail: 'Error interno.' }), 'system-error'],
  ] as const)('clasifica %s a partir de HTTP y una respuesta válida', async (_name, status, body, kind) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(status, body)))

    const result = await requestPayment(paymentValues, 'user-test', 'test@example.com')

    expect(result).toMatchObject({ kind, payment: body })
  })

  it('clasifica un rechazo de fetch sin abort como error de red', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    await expect(requestPayment(paymentValues, 'user-test', 'test@example.com')).resolves.toMatchObject({
      kind: 'network-error',
    })
  })

  it('clasifica una Response con contrato inválido como invalid-response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse(200, { status: 'approved' })))

    await expect(requestPayment(paymentValues, 'user-test', 'test@example.com')).resolves.toMatchObject({
      kind: 'invalid-response',
    })
  })

  it('clasifica el abort iniciado por el timer como timeout sin esperar cinco segundos reales', async () => {
    vi.useFakeTimers()
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal as AbortSignal
      signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
    }))
    vi.stubGlobal('fetch', fetchMock)

    const pending = requestPayment(paymentValues, 'user-test', 'test@example.com')
    await vi.advanceTimersByTimeAsync(5_000)

    await expect(pending).resolves.toMatchObject({ kind: 'timeout' })
    expect((fetchMock.mock.calls[0]?.[1] as RequestInit).signal?.aborted).toBe(true)
  })
})
