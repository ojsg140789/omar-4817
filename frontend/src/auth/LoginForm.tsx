import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { login, type LoginErrors, type LoginValues } from './auth.ts'
import type { AppState } from '../persistence/storage.ts'

interface LoginFormProps {
  onLoggedIn: (state: AppState) => void
}

export default function LoginForm({ onLoggedIn }: LoginFormProps) {
  const [values, setValues] = useState<LoginValues>({ email: '', password: '' })
  const [errors, setErrors] = useState<LoginErrors>({})
  const [submitError, setSubmitError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  function updateField(field: keyof LoginValues, value: string) {
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
      const result = await login(values)
      if (!result.ok) {
        setErrors(result.errors)
        const firstInvalid = form.elements.namedItem(Object.keys(result.errors)[0])
        if (firstInvalid instanceof HTMLInputElement) firstInvalid.focus()
        return
      }
      onLoggedIn(result.state)
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'No se pudo iniciar sesión. Vuelve a intentar.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="auth-card" aria-labelledby="login-title">
      <h2 id="login-title">Iniciar sesión</h2>
      <p>Accede con el correo y la contraseña de tu cuenta local.</p>
      <form className="auth-form" onSubmit={handleSubmit} noValidate aria-busy={isSubmitting}>
        <div className="field">
          <label htmlFor="login-email">Correo electrónico</label>
          <input id="login-email" name="email" type="email" autoComplete="username" required
            value={values.email} onChange={(event) => updateField('email', event.target.value)}
            readOnly={isSubmitting} aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'login-email-error' : undefined} />
          {errors.email && <p className="error" id="login-email-error">{errors.email}</p>}
        </div>
        <div className="field">
          <label htmlFor="login-password">Contraseña</label>
          <input id="login-password" name="password" type="password" autoComplete="current-password" required
            value={values.password} onChange={(event) => updateField('password', event.target.value)}
            readOnly={isSubmitting} aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? 'login-password-error' : undefined} />
          {errors.password && <p className="error" id="login-password-error">{errors.password}</p>}
        </div>
        {submitError && <p className="error" role="alert">{submitError}</p>}
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Verificando…' : 'Iniciar sesión'}
        </button>
        <p className="auth-link"><Link to="/register">Registrarse</Link></p>
        <p className="notice">Esta es una simulación local. Los datos se guardan en este navegador.</p>
      </form>
    </section>
  )
}
