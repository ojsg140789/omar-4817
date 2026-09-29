import { useState, type FormEvent } from 'react'
import {
  parseAmountToCents,
  requestPayment,
  type PaymentFormValues,
  type PaymentHandlingResult,
  type PaymentResponseResult,
} from './payment.ts'

type RechargeErrors = Partial<Record<keyof PaymentFormValues, string>>

interface RechargeFormProps {
  payerId: string
  payerEmail: string
  onPaymentResult: (result: PaymentResponseResult) => PaymentHandlingResult
}

const initialValues: PaymentFormValues = {
  cardNumber: '',
  expiry: '',
  cvv: '',
  fullName: '',
  amount: '',
}

function validate(values: PaymentFormValues): RechargeErrors {
  const errors: RechargeErrors = {}
  if (!/^\d{16}$/.test(values.cardNumber.replace(/\s+/g, ''))) {
    errors.cardNumber = 'Escribe una tarjeta de 16 dígitos.'
  }
  if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(values.expiry.trim())) {
    errors.expiry = 'Usa el formato MM/YY.'
  }
  if (!/^\d{3}$/.test(values.cvv.trim())) {
    errors.cvv = 'Escribe un CVV de 3 dígitos.'
  }
  if (!values.fullName.trim()) {
    errors.fullName = 'Escribe el nombre completo.'
  }
  if (parseAmountToCents(values.amount) === null) {
    errors.amount = 'Escribe un monto mayor que 0 con máximo dos decimales.'
  }
  return errors
}

export default function RechargeForm({ payerId, payerEmail, onPaymentResult }: RechargeFormProps) {
  const [values, setValues] = useState(initialValues)
  const [errors, setErrors] = useState<RechargeErrors>({})
  const [submitError, setSubmitError] = useState('')
  const [submitMessage, setSubmitMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  function updateField(field: keyof PaymentFormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => ({ ...current, [field]: undefined }))
    setSubmitError('')
    setSubmitMessage('')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting) return

    const nextErrors = validate(values)
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      setSubmitMessage('')
      return
    }

    setErrors({})
    setSubmitError('')
    setSubmitMessage('')
    setIsSubmitting(true)
    try {
      const result = await requestPayment(values, payerId, payerEmail)
      if (!('payment' in result)) {
        setSubmitError(result.message)
        return
      }

      const handling = onPaymentResult(result)
      if (handling === 'persistence-failure') {
        setSubmitError('No fue posible guardar el resultado de la recarga. Intenta nuevamente.')
      } else if (result.kind === 'approved' && handling === 'credited') {
        setValues(initialValues)
        setSubmitMessage(result.message)
      } else if (result.kind !== 'approved' && handling === 'recorded') {
        setSubmitError(result.message)
      } else {
        setSubmitError('SnailPay devolvió una respuesta inválida.')
      }
    } catch {
      setSubmitError('No fue posible guardar el resultado de la recarga. Intenta nuevamente.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate aria-busy={isSubmitting}>
      <div className="field">
        <label htmlFor="recharge-card-number">Número de tarjeta</label>
        <input id="recharge-card-number" name="cardNumber" inputMode="numeric" autoComplete="off" required
          value={values.cardNumber} onChange={(event) => updateField('cardNumber', event.target.value)}
          readOnly={isSubmitting} aria-invalid={Boolean(errors.cardNumber)}
          aria-describedby={errors.cardNumber ? 'recharge-card-number-error' : undefined} />
        {errors.cardNumber && <p className="error" id="recharge-card-number-error">{errors.cardNumber}</p>}
      </div>
      <div className="field">
        <label htmlFor="recharge-expiry">Expiración</label>
        <input id="recharge-expiry" name="expiry" placeholder="MM/YY" autoComplete="off" required
          value={values.expiry} onChange={(event) => updateField('expiry', event.target.value)}
          readOnly={isSubmitting} aria-invalid={Boolean(errors.expiry)}
          aria-describedby={errors.expiry ? 'recharge-expiry-error' : undefined} />
        {errors.expiry && <p className="error" id="recharge-expiry-error">{errors.expiry}</p>}
      </div>
      <div className="field">
        <label htmlFor="recharge-cvv">CVV</label>
        <input id="recharge-cvv" name="cvv" inputMode="numeric" autoComplete="off" required
          value={values.cvv} onChange={(event) => updateField('cvv', event.target.value)}
          readOnly={isSubmitting} aria-invalid={Boolean(errors.cvv)}
          aria-describedby={errors.cvv ? 'recharge-cvv-error' : undefined} />
        {errors.cvv && <p className="error" id="recharge-cvv-error">{errors.cvv}</p>}
      </div>
      <div className="field">
        <label htmlFor="recharge-full-name">Nombre completo</label>
        <input id="recharge-full-name" name="fullName" autoComplete="name" required
          value={values.fullName} onChange={(event) => updateField('fullName', event.target.value)}
          readOnly={isSubmitting} aria-invalid={Boolean(errors.fullName)}
          aria-describedby={errors.fullName ? 'recharge-full-name-error' : undefined} />
        {errors.fullName && <p className="error" id="recharge-full-name-error">{errors.fullName}</p>}
      </div>
      <div className="field">
        <label htmlFor="recharge-amount">Monto</label>
        <input id="recharge-amount" name="amount" inputMode="decimal" placeholder="100.50" required
          value={values.amount} onChange={(event) => updateField('amount', event.target.value)}
          readOnly={isSubmitting} aria-invalid={Boolean(errors.amount)}
          aria-describedby={errors.amount ? 'recharge-amount-error' : undefined} />
        {errors.amount && <p className="error" id="recharge-amount-error">{errors.amount}</p>}
      </div>
      {submitError && <p className="error" role="alert">{submitError}</p>}
      {submitMessage && <p className="notice" role="status">{submitMessage}</p>}
      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Procesando…' : 'Confirmar recarga'}
      </button>
    </form>
  )
}
