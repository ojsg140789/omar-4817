import { randomUUID } from 'node:crypto'

// Simulador académico: tarjeta y CVV son ficticios y se devuelven por requisito del ejercicio; en producción nunca deben devolverse ni persistirse.

export type PaymentStatus = 'approved' | 'rejected' | 'error'

export interface PaymentRequest {
  cardNumber: string
  expiry: string
  cvv: string
  fullName: string
  amount: number
  payerId: string
  payerEmail: string
}

export interface PaymentResponse {
  id: string
  status: PaymentStatus
  status_detail: string
  transaction_amount: number | null
  date_created: string
  authorization_code: string | null
  reference: string
  payer_id: string | null
  payer_email: string | null
  card_number: string | null
  cvv: string | null
}

interface ResponseFields {
  amount: number | null
  payerId: string | null
  payerEmail: string | null
  cardNumber: string | null
  cvv: string | null
}

type ValidationResult =
  | { ok: true; value: PaymentRequest }
  | { ok: false; message: string }

const APPROVED_CARD = '1234123412341234'
const APPROVED_EXPIRY = '12/26'
const APPROVED_CVV = '543'
const SYSTEM_ERROR_CARD = '5000000000000005'
const SLOW_AMOUNT = 999.99
const SLOW_DELAY_MS = 10_000
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeCardNumber(value: string): string {
  return value.replace(/\s+/g, '')
}

function responseFields(body: unknown): ResponseFields {
  // Las respuestas de error reflejan únicamente campos que pudieron normalizarse con seguridad.
  const value = isRecord(body) ? body : {}
  return {
    amount: typeof value.amount === 'number' && Number.isFinite(value.amount) ? value.amount : null,
    payerId: typeof value.payerId === 'string' ? value.payerId.trim() || null : null,
    payerEmail: typeof value.payerEmail === 'string' ? value.payerEmail.trim().toLowerCase() || null : null,
    cardNumber: typeof value.cardNumber === 'string' ? normalizeCardNumber(value.cardNumber) || null : null,
    cvv: typeof value.cvv === 'string' ? value.cvv.trim() || null : null,
  }
}

function createResponse(fields: ResponseFields, status: PaymentStatus, statusDetail: string): PaymentResponse {
  // Cada ejecución nueva crea identificadores; los replays los preserva la capa idempotente.
  const id = `pay_${randomUUID()}`
  return {
    id,
    status,
    status_detail: statusDetail,
    transaction_amount: fields.amount,
    date_created: new Date().toISOString(),
    authorization_code: status === 'approved' ? `auth_${randomUUID().slice(0, 8)}` : null,
    reference: `ref_${randomUUID()}`,
    payer_id: fields.payerId,
    payer_email: fields.payerEmail,
    card_number: fields.cardNumber,
    cvv: fields.cvv,
  }
}

export function validatePaymentRequest(body: unknown): ValidationResult {
  // La validación devuelve valores normalizados que comparten simulación e idempotencia.
  if (!isRecord(body)) return { ok: false, message: 'El body debe ser un objeto JSON.' }

  const cardNumber = typeof body.cardNumber === 'string' ? normalizeCardNumber(body.cardNumber) : ''
  if (!/^\d{16}$/.test(cardNumber)) {
    return { ok: false, message: 'cardNumber debe contener exactamente 16 dígitos.' }
  }

  const expiry = typeof body.expiry === 'string' ? body.expiry.trim() : ''
  if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(expiry)) {
    return { ok: false, message: 'expiry debe tener formato MM/YY.' }
  }

  const cvv = typeof body.cvv === 'string' ? body.cvv.trim() : ''
  if (!/^\d{3}$/.test(cvv)) {
    return { ok: false, message: 'cvv debe contener exactamente 3 dígitos.' }
  }

  const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : ''
  if (!fullName) return { ok: false, message: 'fullName es obligatorio.' }

  const amount = body.amount
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
    return { ok: false, message: 'amount debe ser un número finito mayor que 0.' }
  }

  const payerId = typeof body.payerId === 'string' ? body.payerId.trim() : ''
  if (!payerId) return { ok: false, message: 'payerId es obligatorio.' }

  const payerEmail = typeof body.payerEmail === 'string' ? body.payerEmail.trim().toLowerCase() : ''
  if (!emailPattern.test(payerEmail)) {
    return { ok: false, message: 'payerEmail debe tener un formato válido.' }
  }

  return {
    ok: true,
    value: { cardNumber, expiry, cvv, fullName, amount, payerId, payerEmail },
  }
}

export function createInvalidPaymentResponse(body: unknown, message: string): PaymentResponse {
  return createResponse(responseFields(body), 'error', `Solicitud inválida: ${message}`)
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

export async function simulatePayment(request: PaymentRequest): Promise<PaymentResponse> {
  const fields: ResponseFields = {
    amount: request.amount,
    payerId: request.payerId,
    payerEmail: request.payerEmail,
    cardNumber: request.cardNumber,
    cvv: request.cvv,
  }

  if (request.cardNumber === SYSTEM_ERROR_CARD) {
    return createResponse(fields, 'error', 'Error interno simulado de SnailPay.')
  }

  const isApprovedCard = request.cardNumber === APPROVED_CARD
    && request.expiry === APPROVED_EXPIRY
    && request.cvv === APPROVED_CVV

  if (!isApprovedCard) {
    return createResponse(fields, 'rejected', 'Transacción rechazada por la tarjeta de prueba.')
  }

  if (request.amount === SLOW_AMOUNT) {
    // Fixture reproducible para verificar que un timeout del cliente puede reintentarse con la misma clave.
    await wait(SLOW_DELAY_MS)
  }

  return createResponse(fields, 'approved', 'Pago aprobado por SnailPay simulado.')
}
