import express from 'express'
import { createInvalidPaymentResponse, simulatePayment, validatePaymentRequest } from './snailPay.js'

const app = express()

app.use(express.json())

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' })
})

app.post('/api/payments', async (req, res) => {
  const validation = validatePaymentRequest(req.body)
  if (!validation.ok) {
    res.status(400).json(createInvalidPaymentResponse(req.body, validation.message))
    return
  }

  const payment = await simulatePayment(validation.value)
  res.status(payment.status === 'error' ? 500 : 200).json(payment)
})

app.use((error: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (req.path === '/api/payments' && error instanceof SyntaxError) {
    res.status(400).json(createInvalidPaymentResponse(undefined, 'JSON malformado.'))
    return
  }
  next(error)
})

export default app
