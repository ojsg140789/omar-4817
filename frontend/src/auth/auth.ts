import { verifyPassword } from './password.ts'
import { readAppState, saveAppState, type AppState } from '../persistence/storage.ts'

export interface LoginValues {
  email: string
  password: string
}

export type LoginErrors = Partial<Record<keyof LoginValues, string>>

type LoginResult =
  | { ok: true; state: AppState }
  | { ok: false; errors: LoginErrors }

export async function login(values: LoginValues): Promise<LoginResult> {
  // Se normaliza el correo igual que durante el registro para comparar una identidad estable.
  const email = values.email.trim().toLowerCase()
  const errors: LoginErrors = {}

  if (!email) {
    errors.email = 'Escribe tu correo electrónico.'
  } else if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'Escribe un correo electrónico válido de hasta 254 caracteres.'
  }
  if (!values.password) {
    errors.password = 'Escribe tu contraseña.'
  } else if (values.password.length < 8 || values.password.length > 128) {
    errors.password = 'La contraseña debe tener entre 8 y 128 caracteres.'
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors }

  const user = readAppState()?.user
  if (!user || user.email !== email) {
    throw new Error('Correo o contraseña incorrectos.')
  }

  let matches: boolean
  try {
    matches = await verifyPassword(values.password, user.passwordCredential)
  } catch {
    throw new Error('No se pudo verificar la credencial. Usa un navegador compatible en localhost o HTTPS y vuelve a intentar.')
  }
  if (!matches) throw new Error('Correo o contraseña incorrectos.')

  // PBKDF2 es asíncrono: releer evita crear sesión sobre datos que cambiaron durante la espera.
  const current = readAppState()
  const currentCredential = current?.user?.passwordCredential
  if (!current?.user || !currentCredential || current.user.id !== user.id || current.user.email !== user.email
    || currentCredential.algorithm !== user.passwordCredential.algorithm
    || currentCredential.iterations !== user.passwordCredential.iterations
    || currentCredential.salt !== user.passwordCredential.salt
    || currentCredential.derivedKey !== user.passwordCredential.derivedKey) {
    throw new Error('La cuenta cambió durante la verificación. Recarga la página y vuelve a intentar.')
  }

  const state: AppState = { ...current, session: { userId: current.user.id } }
  saveAppState(state)
  return { ok: true, state }
}

export function logout(): AppState {
  const current = readAppState()
  if (!current) {
    throw new Error('No se encontraron los datos locales. Recarga la página para comprobar el estado.')
  }
  // Cerrar sesión preserva usuario y wallet; solo elimina la sesión local.
  const state: AppState = { ...current, session: null }
  saveAppState(state)
  return state
}
