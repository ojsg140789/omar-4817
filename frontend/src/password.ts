export interface PasswordCredential {
  algorithm: 'PBKDF2-SHA-256'
  iterations: number
  salt: string
  derivedKey: string
}

export async function derivePasswordCredential(password: string): Promise<PasswordCredential> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  )
  const iterations = 600_000
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    key,
    256,
  )

  return {
    algorithm: 'PBKDF2-SHA-256',
    iterations,
    salt: btoa(String.fromCharCode(...salt)),
    derivedKey: btoa(String.fromCharCode(...new Uint8Array(bits))),
  }
}
