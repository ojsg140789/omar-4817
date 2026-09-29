export type PaymentStatus = 'approved' | 'rejected' | 'error'

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

export interface PaymentFormValues {
  cardNumber: string
  expiry: string
  cvv: string
  fullName: string
  amount: string
}

export type PaymentResultKind = 'approved' | 'rejected' | 'system-error' | 'invalid-request'

export interface PaymentResponseResult {
  kind: PaymentResultKind
  message: string
  httpOk: boolean
  httpStatus: number
  payment: PaymentResponse
  payerId: string
  payerEmail: string
  requestedCents: number
  requestedCardNumber: string
  requestedCvv: string
}

export interface PaymentClientErrorResult {
  kind: 'network-error' | 'invalid-response'
  message: string
}

export type PaymentResult = PaymentResponseResult | PaymentClientErrorResult

export type PaymentHandlingResult = 'credited' | 'recorded' | 'persistence-failure'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isStringOrNull(value: unknown): value is string | null {
  return typeof value === 'string' || value === null
}

function isNumberOrNull(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isFinite(value))
}

export function isPaymentResponse(value: unknown): value is PaymentResponse {
  return isRecord(value)
    && isNonEmptyString(value.id)
    && (value.status === 'approved' || value.status === 'rejected' || value.status === 'error')
    && isNonEmptyString(value.status_detail)
    && isNumberOrNull(value.transaction_amount)
    && isNonEmptyString(value.date_created)
    && isStringOrNull(value.authorization_code)
    && isNonEmptyString(value.reference)
    && isStringOrNull(value.payer_id)
    && isStringOrNull(value.payer_email)
    && isStringOrNull(value.card_number)
    && isStringOrNull(value.cvv)
}

export function parseAmountToCents(value: string): number | null {
  const amount = value.trim()
  const match = /^(0|[1-9]\d*)(?:\.(\d{1,2}))?$/.exec(amount)
  if (!match) return null

  const whole = Number(match[1])
  const decimal = (match[2] ?? '').padEnd(2, '0')
  const cents = whole * 100 + Number(decimal)
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null
}

export function amountToCents(value: number | null): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null
  const cents = Math.round(value * 100)
  return Number.isSafeInteger(cents) && Math.abs(value - cents / 100) < 0.0000001 ? cents : null
}

export async function requestPayment(
  values: PaymentFormValues,
  payerId: string,
  payerEmail: string,
): Promise<PaymentResult> {
  const requestedCents = parseAmountToCents(values.amount)
  if (requestedCents === null) throw new Error('El monto no tiene un formato válido.')

  const requestedCardNumber = values.cardNumber.replace(/\s+/g, '')
  const requestedCvv = values.cvv.trim()
  const normalizedPayerEmail = payerEmail.trim().toLowerCase()
  let response: Response
  try {
    response = await fetch('/api/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cardNumber: requestedCardNumber,
        expiry: values.expiry.trim(),
        cvv: requestedCvv,
        fullName: values.fullName.trim(),
        amount: requestedCents / 100,
        payerId,
        payerEmail: normalizedPayerEmail,
      }),
    })
  } catch {
    return {
      kind: 'network-error',
      message: 'No fue posible comunicarse con SnailPay. Intenta nuevamente.',
    }
  }

  let body: unknown
  try {
    body = await response.json()
  } catch {
    return {
      kind: 'invalid-response',
      message: 'SnailPay devolvió una respuesta inválida.',
    }
  }
  if (!isPaymentResponse(body)) {
    return {
      kind: 'invalid-response',
      message: 'SnailPay devolvió una respuesta inválida.',
    }
  }

  const kind = response.status === 200 && body.status === 'approved'
    ? 'approved'
    : response.status === 200 && body.status === 'rejected'
      ? 'rejected'
      : response.status === 500 && body.status === 'error'
        ? 'system-error'
        : response.status === 400 && body.status === 'error'
          ? 'invalid-request'
          : null
  if (kind === null) {
    return {
      kind: 'invalid-response',
      message: 'SnailPay devolvió una respuesta inválida.',
    }
  }

  const result: PaymentResponseResult = {
    kind,
    message: kind === 'approved' ? 'Recarga aprobada correctamente.' : body.status_detail,
    httpOk: response.ok,
    httpStatus: response.status,
    payment: body,
    payerId,
    payerEmail: normalizedPayerEmail,
    requestedCents,
    requestedCardNumber,
    requestedCvv,
  }
  return result
}

export function approvedCents(result: PaymentResponseResult): number | null {
  const { payment } = result
  const cents = amountToCents(payment.transaction_amount)
  if (!result.httpOk
    || result.httpStatus !== 200
    || payment.status !== 'approved'
    || cents === null
    || cents !== result.requestedCents
    || payment.payer_id !== result.payerId
    || payment.payer_email !== result.payerEmail
    || !isNonEmptyString(payment.authorization_code)
    || !isNonEmptyString(payment.id)
    || !isNonEmptyString(payment.reference)
    || !isNonEmptyString(payment.date_created)
    || payment.card_number !== result.requestedCardNumber
    || payment.cvv !== result.requestedCvv) {
    return null
  }
  return cents
}
