import { describe, expect, it } from 'vitest'
import { simulatePayment, validatePaymentRequest } from './snailPay.ts'

const validRequest = {
  cardNumber: '1234123412341234',
  expiry: '12/26',
  cvv: '543',
  fullName: 'Persona de Prueba',
  amount: 100.5,
  payerId: 'user-test',
  payerEmail: 'test@example.com',
}

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

  it('rechaza una tarjeta de prueba no autorizada sin crear autorización', async () => {
    const payment = await simulatePayment({ ...validRequest, cardNumber: '4000000000000002' })

    expect(payment.status).toBe('rejected')
    expect(payment.status_detail).toBe('Transacción rechazada por la tarjeta de prueba.')
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

  it('rechaza un monto de cero mediante la validación pública', () => {
    expect(validatePaymentRequest({ ...validRequest, amount: 0 })).toEqual({
      ok: false,
      message: 'amount debe ser un número finito mayor que 0.',
    })
  })
})
