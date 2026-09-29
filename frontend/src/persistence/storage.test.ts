import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readAppState } from './storage.ts'

class MemoryStorage implements Storage {
  #values = new Map<string, string>()

  get length(): number {
    return this.#values.size
  }

  clear(): void {
    this.#values.clear()
  }

  getItem(key: string): string | null {
    return this.#values.get(key) ?? null
  }

  key(index: number): string | null {
    return [...this.#values.keys()][index] ?? null
  }

  removeItem(key: string): void {
    this.#values.delete(key)
  }

  setItem(key: string, value: string): void {
    this.#values.set(key, value)
  }
}

const user = {
  id: 'user-test',
  fullName: 'Persona de Prueba',
  email: 'test@example.com',
  passwordCredential: {
    algorithm: 'PBKDF2-SHA-256' as const,
    iterations: 600_000,
    salt: `${'A'.repeat(22)}==`,
    derivedKey: `${'A'.repeat(43)}=`,
  },
}

function appState(balanceCents: number, lastPayment?: unknown) {
  return {
    user,
    session: { userId: user.id },
    wallet: lastPayment === undefined ? { balanceCents } : { balanceCents, lastPayment },
  }
}

function validPayment() {
  return {
    id: 'pay_test',
    status: 'rejected',
    status_detail: 'Rechazado.',
    transaction_amount: 100.5,
    date_created: '2026-01-01T00:00:00.000Z',
    authorization_code: null,
    reference: 'ref_test',
    payer_id: user.id,
    payer_email: user.email,
    card_number: '4000000000000002',
    cvv: '543',
  }
}

let storage: MemoryStorage

beforeEach(() => {
  storage = new MemoryStorage()
  vi.stubGlobal('localStorage', storage)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('readAppState', () => {
  it('normaliza un estado histórico sin lastPayment y conserva el saldo', () => {
    storage.setItem('app:v1', JSON.stringify(appState(12345)))

    expect(readAppState()).toMatchObject({
      wallet: { balanceCents: 12345, lastPayment: null },
    })
  })

  it('conserva exactamente un balance válido', () => {
    storage.setItem('app:v1', JSON.stringify(appState(98765, null)))

    expect(readAppState()?.wallet.balanceCents).toBe(98765)
  })

  it('rechaza datos corruptos sin sobrescribir ni borrar el contenido original', () => {
    const original = 'datos-corruptos'
    storage.setItem('app:v1', original)

    expect(() => readAppState()).toThrow('No se pudieron leer los datos locales.')
    expect(storage.getItem('app:v1')).toBe(original)
  })

  it('acepta y conserva un lastPayment válido', () => {
    const payment = validPayment()
    storage.setItem('app:v1', JSON.stringify(appState(500, payment)))

    expect(readAppState()?.wallet).toEqual({ balanceCents: 500, lastPayment: payment })
  })
})
