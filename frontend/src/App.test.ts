import { describe, expect, it } from 'vitest'
import { updateWalletForPayment } from './payments/wallet.ts'
import type { PaymentResponseResult } from './payments/payment.ts'
import type { Wallet } from './persistence/storage.ts'

const keyOne = '550e8400-e29b-41d4-a716-446655440000'
const keyTwo = '550e8400-e29b-41d4-a716-446655440001'

function approvedResult(idempotencyKey: string): PaymentResponseResult {
  return {
    kind: 'approved',
    message: 'Recarga aprobada correctamente.',
    httpOk: true,
    httpStatus: 200,
    payment: {
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
    },
    payerId: 'user-test',
    payerEmail: 'test@example.com',
    requestedCents: 10050,
    requestedCardNumber: '1234123412341234',
    requestedCvv: '543',
    idempotencyKey,
  }
}

describe('updateWalletForPayment', () => {
  it('acredita una clave nueva una sola vez y acredita otra clave independiente', () => {
    const initial: Wallet = { balanceCents: 100, lastPayment: null, appliedIdempotencyKeys: [] }
    const first = updateWalletForPayment(initial, approvedResult(keyOne))
    const replay = updateWalletForPayment(first.wallet, approvedResult(keyOne))
    const second = updateWalletForPayment(replay.wallet, approvedResult(keyTwo))

    expect(first).toMatchObject({ handling: 'credited', wallet: { balanceCents: 10150, appliedIdempotencyKeys: [keyOne] } })
    expect(replay).toMatchObject({ handling: 'already-credited', wallet: { balanceCents: 10150, appliedIdempotencyKeys: [keyOne] } })
    expect(second).toMatchObject({ handling: 'credited', wallet: { balanceCents: 20200, appliedIdempotencyKeys: [keyOne, keyTwo] } })
  })
})
