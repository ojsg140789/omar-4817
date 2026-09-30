import express from 'express'
import cors from 'cors'
import { getIdempotencyOperation, isIdempotencyKey } from './payments/idempotency.js'
import { createInvalidPaymentResponse, simulatePayment, validatePaymentRequest } from './payments/snailPay.js'

const app = express()

const developmentOrigins = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
])

function configuredFrontendOrigin(): string | null {
  // Solo se acepta un origen completo, sin rutas, para no abrir CORS por una variable mal formada.
  const value = process.env.FRONTEND_ORIGIN?.trim()
  if (!value) return null

  try {
    const origin = new URL(value).origin
    return origin !== 'null' && value.replace(/\/+$/, '') === origin ? origin : null
  } catch {
    return null
  }
}

function isAllowedOrigin(origin: string | undefined): boolean {
  // Solicitudes sin Origin, como health checks, no requieren una concesión CORS.
  if (!origin) return true
  const frontendOrigin = configuredFrontendOrigin()
  if (process.env.NODE_ENV === 'production') return frontendOrigin === origin
  return developmentOrigins.has(origin)
}

app.use(cors({
  // La función se evalúa por petición para que el entorno real y las pruebas lean valores actuales.
  origin: (origin, callback) => callback(null, isAllowedOrigin(origin)),
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Idempotency-Key'],
}))

// Convierte el body JSON antes de validar el contrato de pagos.
app.use(express.json())

app.get('/health', (_req, res) => {
  // Endpoint mínimo para comprobar que el proceso está disponible sin ejecutar negocio.
  res.status(200).json({ status: 'ok' })
})

app.post('/api/payments', async (req, res) => {
  // La clave se valida antes de crear o consultar una operación idempotente.
  const idempotencyKey = req.get('Idempotency-Key')
  if (!isIdempotencyKey(idempotencyKey)) {
    res.status(400).json(createInvalidPaymentResponse(req.body, 'Idempotency-Key debe ser un UUID válido.'))
    return
  }

  // El fingerprint usa este resultado normalizado, no el JSON crudo recibido.
  const validation = validatePaymentRequest(req.body)
  if (!validation.ok) {
    res.status(400).json(createInvalidPaymentResponse(req.body, validation.message))
    return
  }

  // La caché conserva también operaciones pendientes para que reintentos concurrentes compartan una sola simulación.
  const operation = getIdempotencyOperation(idempotencyKey, validation.value, async () => {
    const payment = await simulatePayment(validation.value)
    return {
      statusCode: payment.status === 'error' ? 500 : 200,
      response: payment,
    }
  })
  if (operation.kind === 'conflict') {
    // Reusar una clave para otro payload no ejecuta una segunda operación.
    res.status(409).json(createInvalidPaymentResponse(req.body, 'Idempotency-Key ya se usó con otra operación.'))
    return
  }

  const result = await operation.result
  res.status(result.statusCode).json(result.response)
})

app.use((error: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
  // express.json delega aquí JSON malformado para responder con el contrato de pagos.
  if (req.path === '/api/payments' && error instanceof SyntaxError) {
    res.status(400).json(createInvalidPaymentResponse(undefined, 'JSON malformado.'))
    return
  }
  next(error)
})

export default app
