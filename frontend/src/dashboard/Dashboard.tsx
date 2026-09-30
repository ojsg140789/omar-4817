import { useEffect, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { lostCount, outcomeData, winsBySnail, wonCount } from './dashboardData.ts'
import RechargeForm from '../payments/RechargeForm.tsx'
import { warmUpBackend, type PaymentHandlingResult, type PaymentResponseResult } from '../payments/payment.ts'

interface DashboardProps {
  fullName: string
  userId: string
  userEmail: string
  balanceCents: number
  logoutError: string
  onLogout: () => void
  onPaymentResult: (result: PaymentResponseResult) => PaymentHandlingResult
}

const outcomeColors = ['#15803d', '#b91c1c']

function Dashboard({ fullName, userId, userEmail, balanceCents, logoutError, onLogout, onPaymentResult }: DashboardProps) {
  const [showRechargeForm, setShowRechargeForm] = useState(false)

  useEffect(() => {
    // El Dashboard renderiza sin depender de este GET; StrictMode puede repetirlo en desarrollo y no tiene efectos de negocio.
    void warmUpBackend()
  }, [])

  return (
    <section className="dashboard" aria-labelledby="dashboard-title">
      <div className="dashboard-header">
        <div>
          <h2 id="dashboard-title">Bienvenido, {fullName}</h2>
          <p>Consulta el resumen de las seis carreras simuladas del día.</p>
        </div>
        <button type="button" onClick={onLogout}>Cerrar sesión</button>
      </div>

      <section className="balance-card" aria-label="Saldo actual">
        <h3>Saldo actual</h3>
        <p className="balance">${(balanceCents / 100).toFixed(2)}</p>
      </section>

      {logoutError && <p className="error" role="alert">{logoutError}</p>}

      <div className="dashboard-charts">
        <section className="chart-card" aria-labelledby="outcomes-title">
          <h3 id="outcomes-title">Resultados de tus apuestas</h3>
          <p className="chart-summary">Ganadas: {wonCount} · Perdidas: {lostCount}</p>
          <div className="chart" role="img" aria-label={`${wonCount} apuestas ganadas y ${lostCount} perdidas`}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={outcomeData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius="55%"
                  outerRadius="80%"
                  paddingAngle={3}
                >
                  {outcomeData.map((entry, index) => (
                    <Cell key={entry.name} fill={outcomeColors[index]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {/* La lista conserva el mismo dato del gráfico para lectores de pantalla y sin color. */}
          <ul className="chart-list">
            {outcomeData.map((outcome) => (
              <li key={outcome.name}>{outcome.name}: {outcome.value}</li>
            ))}
          </ul>
        </section>

        <section className="chart-card" aria-labelledby="wins-title">
          <h3 id="wins-title">Victorias por caracol</h3>
          <div className="chart chart-bars" role="img" aria-label="Victorias de los seis caracoles">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={winsBySnail} layout="vertical" margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis dataKey="name" type="category" width={58} />
                <Tooltip />
                <Bar dataKey="wins" name="Victorias" fill="#1d4ed8" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <ul className="chart-list">
            {winsBySnail.map((snail) => (
              <li key={snail.name}>{snail.name}: {snail.wins}</li>
            ))}
          </ul>
        </section>
      </div>

      <section className="recharge-card" aria-labelledby="recharge-title">
        <h3 id="recharge-title">Recargar saldo</h3>
        <p>Agrega fondos con los datos ficticios de la prueba.</p>
        <button type="button" onClick={() => setShowRechargeForm((visible) => !visible)}>
          {showRechargeForm ? 'Ocultar formulario' : 'Recargar saldo'}
        </button>
        {showRechargeForm && (
          // Dashboard entrega los datos del pagador; App conserva la responsabilidad de persistir el wallet.
          <RechargeForm payerId={userId} payerEmail={userEmail} onPaymentResult={onPaymentResult} />
        )}
      </section>
    </section>
  )
}

export default Dashboard
