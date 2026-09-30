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

export type PaymentResultKind = 'approved' | 'rejected' | 'system-error' | 'invalid-request' | 'idempotency-conflict'

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
  idempotencyKey: string
}

export interface PaymentClientErrorResult {
  kind: 'network-error' | 'invalid-response' | 'timeout'
  message: string
}

export type PaymentResult = PaymentResponseResult | PaymentClientErrorResult

export type PaymentHandlingResult = 'credited' | 'already-credited' | 'recorded' | 'persistence-failure'

const PAYMENT_TIMEOUT_MS = 5_000

export function paymentEndpoint(baseUrl = import.meta.env.VITE_API_URL): string {
  // En local queda relativa para que Vite la redirija; en producción acepta una base pública configurable.
  const normalizedBaseUrl = baseUrl?.trim().replace(/\/+$/, '') ?? ''
  return `${normalizedBaseUrl}/api/payments`
}

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
  idempotencyKey: string,
): Promise<PaymentResult> {
  // Se normalizan los valores antes de enviarlos para que coincidan con la operación idempotente del servidor.
  const requestedCents = parseAmountToCents(values.amount)
  if (requestedCents === null) throw new Error('El monto no tiene un formato válido.')

  const requestedCardNumber = values.cardNumber.replace(/\s+/g, '')
  const requestedCvv = values.cvv.trim()
  const normalizedPayerEmail = payerEmail.trim().toLowerCase()
  const controller = new AbortController()
  let timedOut = false
  // El cliente deja de esperar a los cinco segundos, aunque el simulador pueda completar la operación después.
  const timeoutId = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, PAYMENT_TIMEOUT_MS)
  const timeoutResult: PaymentClientErrorResult = {
    kind: 'timeout',
    message: 'La recarga tardó demasiado en responder. Intenta nuevamente.',
  }

  try {
    let response: Response
    try {
      response = await fetch(paymentEndpoint(), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // La misma clave identifica reintentos de una misma intención de recarga.
          'Idempotency-Key': idempotencyKey,
        },
        signal: controller.signal,
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
      // Solo un rechazo de fetch sin abort se considera un problema de red.
      return timedOut && controller.signal.aborted
        ? timeoutResult
        : {
            kind: 'network-error',
            message: 'No fue posible comunicarse con SnailPay. Intenta nuevamente.',
          }
    }

    let body: unknown
    try {
      body = await response.json()
    } catch {
      return timedOut && controller.signal.aborted
        ? timeoutResult
        : {
            kind: 'invalid-response',
            message: 'SnailPay devolvió una respuesta inválida.',
          }
    }
    if (timedOut && controller.signal.aborted) return timeoutResult
    if (!isPaymentResponse(body)) {
      // Una respuesta HTTP no basta: se valida el contrato antes de usar sus datos.
      return {
        kind: 'invalid-response',
        message: 'SnailPay devolvió una respuesta inválida.',
      }
    }

    // El estado HTTP y el estado de negocio deben coincidir para clasificar el resultado.
    const kind = response.status === 200 && body.status === 'approved'
      ? 'approved'
      : response.status === 200 && body.status === 'rejected'
        ? 'rejected'
        : response.status === 500 && body.status === 'error'
          ? 'system-error'
          : response.status === 400 && body.status === 'error'
            ? 'invalid-request'
            : response.status === 409 && body.status === 'error'
              ? 'idempotency-conflict'
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
      idempotencyKey,
    }
    return result
  } finally {
    // Se limpia siempre para que una solicitud resuelta no pueda abortarse más tarde.
    clearTimeout(timeoutId)
  }
}

export function approvedCents(result: PaymentResponseResult): number | null {
  const { payment } = result
  const cents = amountToCents(payment.transaction_amount)
  // Solo una respuesta aprobada y coherente con la solicitud puede acreditar saldo local.
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
