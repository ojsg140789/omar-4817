export interface PasswordCredential {
  algorithm: 'PBKDF2-SHA-256'
  iterations: number
  salt: string
  derivedKey: string
}

async function derivePasswordKey(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    key,
    256,
  )

  return btoa(String.fromCharCode(...new Uint8Array(bits)))
}

export async function derivePasswordCredential(password: string): Promise<PasswordCredential> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iterations = 600_000
  const derivedKey = await derivePasswordKey(password, salt, iterations)

  return {
    algorithm: 'PBKDF2-SHA-256',
    iterations,
    salt: btoa(String.fromCharCode(...salt)),
    derivedKey,
  }
}

export async function verifyPassword(
  password: string,
  credential: PasswordCredential,
): Promise<boolean> {
  if (credential.algorithm !== 'PBKDF2-SHA-256') {
    throw new Error('El algoritmo de la credencial no es compatible.')
  }
  const salt = Uint8Array.from(atob(credential.salt), (character) => character.charCodeAt(0))
  const derivedKey = await derivePasswordKey(password, salt, credential.iterations)
  return derivedKey === credential.derivedKey
}
