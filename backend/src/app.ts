import express from 'express'
import { getIdempotencyOperation, isIdempotencyKey } from './payments/idempotency.js'
import { createInvalidPaymentResponse, simulatePayment, validatePaymentRequest } from './payments/snailPay.js'

const app = express()

app.use(express.json())

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' })
})

app.post('/api/payments', async (req, res) => {
  const idempotencyKey = req.get('Idempotency-Key')
  if (!isIdempotencyKey(idempotencyKey)) {
    res.status(400).json(createInvalidPaymentResponse(req.body, 'Idempotency-Key debe ser un UUID válido.'))
    return
  }

  const validation = validatePaymentRequest(req.body)
  if (!validation.ok) {
    res.status(400).json(createInvalidPaymentResponse(req.body, validation.message))
    return
  }

  const operation = getIdempotencyOperation(idempotencyKey, validation.value, async () => {
    const payment = await simulatePayment(validation.value)
    return {
      statusCode: payment.status === 'error' ? 500 : 200,
      response: payment,
    }
  })
  if (operation.kind === 'conflict') {
    res.status(409).json(createInvalidPaymentResponse(req.body, 'Idempotency-Key ya se usó con otra operación.'))
    return
  }

  const result = await operation.result
  res.status(result.statusCode).json(result.response)
})

app.use((error: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (req.path === '/api/payments' && error instanceof SyntaxError) {
    res.status(400).json(createInvalidPaymentResponse(undefined, 'JSON malformado.'))
    return
  }
  next(error)
})

export default app
