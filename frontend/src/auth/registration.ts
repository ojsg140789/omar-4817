import { derivePasswordCredential } from './password.ts'
import { readAppState, saveAppState, type AppState } from '../persistence/storage.ts'

export interface RegistrationValues {
  fullName: string
  email: string
  password: string
  passwordConfirmation: string
}

export type RegistrationErrors = Partial<Record<keyof RegistrationValues, string>>

type RegistrationResult =
  | { ok: true; state: AppState }
  | { ok: false; errors: RegistrationErrors }

export async function registerUser(values: RegistrationValues): Promise<RegistrationResult> {
  // Se compactan espacios y se normaliza el correo antes de validar y persistir.
  const fullName = values.fullName.trim().replace(/\s+/g, ' ')
  const email = values.email.trim().toLowerCase()
  const errors: RegistrationErrors = {}

  if (!fullName || fullName.length > 100) {
    errors.fullName = 'Escribe un nombre de entre 1 y 100 caracteres.'
  }
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'Escribe un correo electrónico válido de hasta 254 caracteres.'
  }
  if (values.password.length < 8 || values.password.length > 128) {
    errors.password = 'La contraseña debe tener entre 8 y 128 caracteres.'
  }
  if (values.passwordConfirmation !== values.password) {
    errors.passwordConfirmation = 'Las contraseñas deben coincidir exactamente.'
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors }

  // La aplicación admite una sola cuenta local y no debe sobrescribirla.
  if (readAppState()?.user) {
    throw new Error('Ya existe una cuenta local en este navegador. No se reemplazará con otro registro.')
  }

  // La derivación ocurre antes de construir el estado para no persistir secretos en texto plano.
  let passwordCredential
  let id: string
  try {
    passwordCredential = await derivePasswordCredential(values.password)
    id = crypto.randomUUID()
  } catch {
    throw new Error('No se pudo preparar la credencial. Usa un navegador compatible en localhost o HTTPS y vuelve a intentar.')
  }

  const state: AppState = {
    user: { id, fullName, email, passwordCredential },
    session: { userId: id },
    wallet: { balanceCents: 0, lastPayment: null, appliedIdempotencyKeys: [] },
  }

  // Se comprueba otra vez después de PBKDF2 por si otra acción creó la cuenta durante la espera.
  if (readAppState()?.user) {
    throw new Error('Ya existe una cuenta local en este navegador. No se reemplazará con otro registro.')
  }
  saveAppState(state)
  return { ok: true, state }
}
