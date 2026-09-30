import type { Wallet } from '../persistence/storage.ts'
import { approvedCents, type PaymentHandlingResult, type PaymentResponseResult } from './payment.ts'

export function updateWalletForPayment(
  wallet: Wallet,
  result: PaymentResponseResult,
): { wallet: Wallet; handling: Exclude<PaymentHandlingResult, 'persistence-failure'> } {
  const cents = approvedCents(result)
  if (cents === null) {
    // Rechazos y errores se registran como último resultado, pero nunca acreditan saldo.
    return {
      wallet: { ...wallet, lastPayment: result.payment },
      handling: 'recorded',
    }
  }

  // Un replay puede actualizar lastPayment, pero la clave ya aplicada impide sumar dos veces.
  const alreadyApplied = wallet.appliedIdempotencyKeys.includes(result.idempotencyKey)
  return {
    wallet: {
      ...wallet,
      balanceCents: alreadyApplied ? wallet.balanceCents : wallet.balanceCents + cents,
      lastPayment: result.payment,
      appliedIdempotencyKeys: alreadyApplied
        ? wallet.appliedIdempotencyKeys
        : [...wallet.appliedIdempotencyKeys, result.idempotencyKey],
    },
    handling: alreadyApplied ? 'already-credited' : 'credited',
  }
}
