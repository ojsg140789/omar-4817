import type { PasswordCredential } from './password.ts'

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
}

export interface AppState {
  user: User | null
  session: Session | null
  wallet: Wallet
}

const STORAGE_KEY = 'app:v1'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isAppState(value: unknown): value is AppState {
  if (!isRecord(value) || !isRecord(value.wallet)) return false
  const balance = value.wallet.balanceCents
  if (typeof balance !== 'number' || !Number.isSafeInteger(balance) || balance < 0) {
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

  return value.session === null
    || (isRecord(value.session) && value.session.userId === user.id)
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
  return value
}

export function saveAppState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    throw new Error('No se pudieron guardar los datos locales. Comprueba el almacenamiento del navegador y vuelve a intentar.')
  }
}
