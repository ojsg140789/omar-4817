import { useState, type FormEvent } from 'react'
import { registerUser, type RegistrationErrors, type RegistrationValues } from './registration.ts'
import type { AppState } from '../persistence/storage.ts'

interface RegisterFormProps {
  onRegistered: (state: AppState) => void
}

export default function RegisterForm({ onRegistered }: RegisterFormProps) {
  const [values, setValues] = useState<RegistrationValues>({
    fullName: '', email: '', password: '', passwordConfirmation: '',
  })
  const [errors, setErrors] = useState<RegistrationErrors>({})
  const [submitError, setSubmitError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  function updateField(field: keyof RegistrationValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
    setSubmitError('')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting) return
    const form = event.currentTarget
    setErrors({})
    setSubmitError('')
    setIsSubmitting(true)
    try {
      const result = await registerUser(values)
      if (!result.ok) {
        setErrors(result.errors)
        const firstInvalid = form.elements.namedItem(Object.keys(result.errors)[0])
        if (firstInvalid instanceof HTMLInputElement) firstInvalid.focus()
        return
      }
      onRegistered(result.state)
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'No se pudo completar el registro. Vuelve a intentar.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section aria-labelledby="register-title">
      <h2 id="register-title">Crear cuenta</h2>
      <p>Registra una cuenta local para acceder a la aplicación.</p>
      <form onSubmit={handleSubmit} noValidate aria-busy={isSubmitting}>
        <div className="field">
          <label htmlFor="fullName">Nombre completo</label>
          <input id="fullName" name="fullName" autoComplete="name" required
            value={values.fullName} onChange={(event) => updateField('fullName', event.target.value)}
            readOnly={isSubmitting} aria-invalid={Boolean(errors.fullName)}
            aria-describedby={errors.fullName ? 'fullName-error' : undefined} />
          {errors.fullName && <p className="error" id="fullName-error">{errors.fullName}</p>}
        </div>
        <div className="field">
          <label htmlFor="email">Correo electrónico</label>
          <input id="email" name="email" type="email" autoComplete="email" required
            value={values.email} onChange={(event) => updateField('email', event.target.value)}
            readOnly={isSubmitting} aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'email-error' : undefined} />
          {errors.email && <p className="error" id="email-error">{errors.email}</p>}
        </div>
        <div className="field">
          <label htmlFor="password">Contraseña</label>
          <input id="password" name="password" type="password" autoComplete="new-password" required
            value={values.password} onChange={(event) => updateField('password', event.target.value)}
            readOnly={isSubmitting} aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? 'password-hint password-error' : 'password-hint'} />
          <p id="password-hint">Entre 8 y 128 caracteres. Los espacios cuentan.</p>
          {errors.password && <p className="error" id="password-error">{errors.password}</p>}
        </div>
        <div className="field">
          <label htmlFor="passwordConfirmation">Confirmar contraseña</label>
          <input id="passwordConfirmation" name="passwordConfirmation" type="password" autoComplete="new-password" required
            value={values.passwordConfirmation} onChange={(event) => updateField('passwordConfirmation', event.target.value)}
            readOnly={isSubmitting} aria-invalid={Boolean(errors.passwordConfirmation)}
            aria-describedby={errors.passwordConfirmation ? 'passwordConfirmation-error' : undefined} />
          {errors.passwordConfirmation && <p className="error" id="passwordConfirmation-error">{errors.passwordConfirmation}</p>}
        </div>
        {submitError && <p className="error" role="alert">{submitError}</p>}
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creando cuenta…' : 'Crear cuenta'}
        </button>
        <p className="notice">Esta es una simulación local. Los datos se guardan en este navegador.</p>
      </form>
    </section>
  )
}
