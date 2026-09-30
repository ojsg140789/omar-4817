import { afterEach, describe, expect, it, vi } from 'vitest'
import { getIdempotencyOperation, isIdempotencyKey } from './idempotency.ts'
import { simulatePayment, validatePaymentRequest, type PaymentRequest } from './snailPay.ts'

const validRequest = {
  cardNumber: '1234123412341234',
  expiry: '12/26',
  cvv: '543',
  fullName: 'Persona de Prueba',
  amount: 100.5,
  payerId: 'user-test',
  payerEmail: 'test@example.com',
}

function key(suffix: string): string {
  return `550e8400-e29b-41d4-a716-${suffix.padStart(12, '0')}`
}

function execute(request: PaymentRequest) {
  return async () => {
    const response = await simulatePayment(request)
    return { statusCode: response.status === 'error' ? 500 : 200, response }
  }
}

afterEach(() => {
  vi.useRealTimers()
})

describe('SnailPay', () => {
  it('aprueba la fixture autorizada con el contrato completo', async () => {
    const payment = await simulatePayment(validRequest)

    expect(payment).toMatchObject({
      status: 'approved',
      transaction_amount: 100.5,
      payer_id: 'user-test',
      payer_email: 'test@example.com',
      card_number: '1234123412341234',
      cvv: '543',
    })
    expect(payment.authorization_code).toMatch(/^auth_/)
    expect(payment.id).toMatch(/^pay_/)
    expect(payment.reference).toMatch(/^ref_/)
    expect(payment.date_created).toEqual(expect.any(String))
  })

  it('rechaza una tarjeta de prueba no autorizada sin crear autorizaciÃ³n', async () => {
    const payment = await simulatePayment({ ...validRequest, cardNumber: '4000000000000002' })

    expect(payment.status).toBe('rejected')
    expect(payment.status_detail).toBe('TransacciÃ³n rechazada por la tarjeta de prueba.')
    expect(payment.authorization_code).toBeNull()
    expect(payment).toMatchObject({
      transaction_amount: 100.5,
      payer_id: 'user-test',
      payer_email: 'test@example.com',
      card_number: '4000000000000002',
      cvv: '543',
    })
    expect(payment.id).toMatch(/^pay_/)
    expect(payment.reference).toMatch(/^ref_/)
    expect(payment.date_created).toEqual(expect.any(String))
  })

  it('representa el error interno simulado sin aprobar el pago', async () => {
    const payment = await simulatePayment({ ...validRequest, cardNumber: '5000000000000005' })

    expect(payment.status).toBe('error')
    expect(payment.status_detail).toBe('Error interno simulado de SnailPay.')
    expect(payment.authorization_code).toBeNull()
  })

  it('rechaza un monto de cero mediante la validaciÃ³n pÃºblica', () => {
    expect(validatePaymentRequest({ ...validRequest, amount: 0 })).toEqual({
      ok: false,
      message: 'amount debe ser un nÃºmero finito mayor que 0.',
    })
  })
})

describe('idempotencia de SnailPay', () => {
  it('acepta únicamente claves UUID válidas', () => {
    expect(isIdempotencyKey(key('1'))).toBe(true)
    expect(isIdempotencyKey(undefined)).toBe(false)
    expect(isIdempotencyKey('no-es-uuid')).toBe(false)
  })

  it('reproduce exactamente una respuesta approved y una respuesta system-error', async () => {
    const approvedOperation = getIdempotencyOperation(key('2'), validRequest, execute(validRequest))
    if (approvedOperation.kind === 'conflict') throw new Error('Operación inesperadamente conflictiva.')
    const approvedReplay = getIdempotencyOperation(key('2'), validRequest, execute(validRequest))
    if (approvedReplay.kind === 'conflict') throw new Error('Operación inesperadamente conflictiva.')

    await expect(approvedReplay.result).resolves.toEqual(await approvedOperation.result)

    const systemRequest = { ...validRequest, cardNumber: '5000000000000005' }
    const systemOperation = getIdempotencyOperation(key('3'), systemRequest, execute(systemRequest))
    if (systemOperation.kind === 'conflict') throw new Error('Operación inesperadamente conflictiva.')
    const systemReplay = getIdempotencyOperation(key('3'), systemRequest, execute(systemRequest))
    if (systemReplay.kind === 'conflict') throw new Error('Operación inesperadamente conflictiva.')

    const systemResult = await systemOperation.result
    await expect(systemReplay.result).resolves.toEqual(systemResult)
    expect(systemResult.statusCode).toBe(500)
    expect(systemResult.response.status).toBe('error')
  })

  it('comparte la promesa de una operación lenta concurrente y simula una vez', async () => {
    // La Promise pendiente en memoria cierra la carrera entre dos solicitudes con la misma clave.
    vi.useFakeTimers()
    const slowRequest = { ...validRequest, amount: 999.99 }
    let executions = 0
    const slowExecute = async () => {
      executions += 1
      const response = await simulatePayment(slowRequest)
      return { statusCode: 200, response }
    }

    const first = getIdempotencyOperation(key('4'), slowRequest, slowExecute)
    const second = getIdempotencyOperation(key('4'), slowRequest, slowExecute)
    if (first.kind === 'conflict' || second.kind === 'conflict') throw new Error('Operación inesperadamente conflictiva.')

    expect(first.result).toBe(second.result)
    await vi.advanceTimersByTimeAsync(10_000)
    await expect(first.result).resolves.toMatchObject({ statusCode: 200, response: { status: 'approved' } })
    expect(executions).toBe(1)
  })

  it('rechaza una misma clave con otro payload sin ejecutar una segunda operación', async () => {
    let executions = 0
    const first = getIdempotencyOperation(key('5'), validRequest, async () => {
      executions += 1
      return { statusCode: 200, response: await simulatePayment(validRequest) }
    })
    const conflict = getIdempotencyOperation(
      key('5'),
      { ...validRequest, amount: 100.51 },
      async () => {
        executions += 1
        return { statusCode: 200, response: await simulatePayment(validRequest) }
      },
    )

    expect(conflict).toEqual({ kind: 'conflict' })
    if (first.kind === 'conflict') throw new Error('Operación inesperadamente conflictiva.')
    await first.result
    expect(executions).toBe(1)
  })

  it('elimina una operación cuyo fallo inesperado no produjo resultado', async () => {
    const first = getIdempotencyOperation(key('6'), validRequest, async () => {
      throw new Error('Fallo inesperado.')
    })
    if (first.kind === 'conflict') throw new Error('Operación inesperadamente conflictiva.')
    await expect(first.result).rejects.toThrow('Fallo inesperado.')
    await Promise.resolve()

    const retry = getIdempotencyOperation(key('6'), validRequest, execute(validRequest))
    expect(retry.kind).toBe('new')
  })
})
