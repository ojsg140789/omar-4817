import type { PasswordCredential } from '../auth/password.ts'
import { isPaymentResponse, type PaymentResponse } from '../payments/payment.ts'

export interface User {
  id: string
  fullName: string
  email: string
  passwordCredential: PasswordCredential
}

export interface Session {
  userId: string
}

export interface Wallet {
  balanceCents: number
  lastPayment: PaymentResponse | null
  appliedIdempotencyKeys: string[]
}

export interface AppState {
  user: User | null
  session: Session | null
  wallet: Wallet
}

// Una única clave agrupa el estado local versionado de la demostración.
const STORAGE_KEY = 'app:v1'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

type StoredAppState = Omit<AppState, 'wallet'> & {
  wallet: Omit<Wallet, 'lastPayment' | 'appliedIdempotencyKeys'> & {
    lastPayment?: PaymentResponse | null
    appliedIdempotencyKeys?: string[]
  }
}

function isAppState(value: unknown): value is StoredAppState {
  // Validar todo el contrato evita que LocalStorage corrupto llegue a las vistas privadas.
  if (!isRecord(value) || !isRecord(value.wallet)) return false
  const balance = value.wallet.balanceCents
  if (typeof balance !== 'number' || !Number.isSafeInteger(balance) || balance < 0) {
    return false
  }
  if (value.wallet.lastPayment !== undefined && value.wallet.lastPayment !== null
    && !isPaymentResponse(value.wallet.lastPayment)) {
    return false
  }
  if (value.wallet.appliedIdempotencyKeys !== undefined
    && (!Array.isArray(value.wallet.appliedIdempotencyKeys)
      || value.wallet.appliedIdempotencyKeys.some((key) => typeof key !== 'string' || !key.trim())
      || new Set(value.wallet.appliedIdempotencyKeys).size !== value.wallet.appliedIdempotencyKeys.length)) {
    return false
  }

  if (value.user === null) return value.session === null && balance === 0
  const user = value.user
  if (!isRecord(user)
    || typeof user.id !== 'string' || !user.id.trim()
    || typeof user.fullName !== 'string' || !user.fullName.trim() || user.fullName.length > 100
    || typeof user.email !== 'string' || user.email.length > 254
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user.email)) {
    return false
  }

  const credential = user.passwordCredential
  if (!isRecord(credential)
    || credential.algorithm !== 'PBKDF2-SHA-256'
    || credential.iterations !== 600_000
    || typeof credential.salt !== 'string'
    || !/^[A-Za-z0-9+/]{22}==$/.test(credential.salt)
    || typeof credential.derivedKey !== 'string'
    || !/^[A-Za-z0-9+/]{43}=$/.test(credential.derivedKey)) {
    return false
  }

  const hasValidSession = value.session === null
    || (isRecord(value.session) && value.session.userId === user.id)
  return hasValidSession
}

export function readAppState(): AppState | null {
  let value: unknown
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === null) return null
    value = JSON.parse(stored)
  } catch {
    throw new Error('No se pudieron leer los datos locales. Comprueba que el navegador permita el almacenamiento. No se ha borrado ningún dato.')
  }

  if (!isAppState(value)) {
    throw new Error('Los datos locales no tienen un formato válido. No se han borrado ni reemplazado.')
  }
  // Los estados anteriores no tenían estos campos; se normalizan sin reescribir el almacenamiento.
  return {
    ...value,
    wallet: {
      balanceCents: value.wallet.balanceCents,
      lastPayment: value.wallet.lastPayment ?? null,
      appliedIdempotencyKeys: value.wallet.appliedIdempotencyKeys ?? [],
    },
  }
}

export function saveAppState(state: AppState): void {
  try {
    // La escritura ocurre antes de que App actualice el estado visual para mantenerlos coherentes.
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    throw new Error('No se pudieron guardar los datos locales. Comprueba el almacenamiento del navegador y vuelve a intentar.')
  }
}
