import { useState } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router'
import Dashboard from './dashboard/Dashboard.tsx'
import RegisterForm from './auth/RegisterForm.tsx'
import LoginForm from './auth/LoginForm.tsx'
import { logout } from './auth/auth.ts'
import ProtectedRoute from './auth/ProtectedRoute.tsx'
import { type PaymentHandlingResult, type PaymentResponseResult } from './payments/payment.ts'
import { updateWalletForPayment } from './payments/wallet.ts'
import { readAppState, saveAppState, type AppState } from './persistence/storage.ts'

function loadStoredState(): { state: AppState | null; error: string } {
  try {
    return { state: readAppState(), error: '' }
  } catch (error) {
    return {
      state: null,
      error: error instanceof Error ? error.message : 'No se pudieron cargar los datos locales.',
    }
  }
}

function App() {
  const [stored, setStored] = useState(loadStoredState)
  const [logoutError, setLogoutError] = useState('')
  const { state, error } = stored
  const location = useLocation()
  const navigate = useNavigate()
  const authenticated = Boolean(state?.user && state.session?.userId === state.user.id)
  const isAuthPage = location.pathname === '/login' || location.pathname === '/register'

  function handleLogout() {
    setLogoutError('')
    try {
      const updated = logout()
      setStored({ state: updated, error: '' })
      navigate('/login', { replace: true })
    } catch (error) {
      setLogoutError(error instanceof Error ? error.message : 'No se pudo cerrar sesión. Vuelve a intentar.')
    }
  }

  function handlePaymentResult(result: PaymentResponseResult): PaymentHandlingResult {
    const current = readAppState()
    if (!current?.user || current.session?.userId !== current.user.id
      || current.user.id !== result.payerId || current.user.email !== result.payerEmail) {
      throw new Error('La sesión cambió durante la recarga. Recarga la página y vuelve a intentar.')
    }

    const walletUpdate = updateWalletForPayment(current.wallet, result)
    const updated: AppState = {
      ...current,
      wallet: walletUpdate.wallet,
    }
    try {
      saveAppState(updated)
    } catch {
      return 'persistence-failure'
    }
    setStored({ state: updated, error: '' })
    return walletUpdate.handling
  }

  return (
    <main className={isAuthPage ? 'auth-page' : undefined}>
      <h1 className={isAuthPage ? 'auth-brand' : undefined}>Sistema de caracoles</h1>
      {error ? (
        <section aria-label="Error de almacenamiento">
          <p className="error" role="alert">{error}</p>
          <button type="button" onClick={() => setStored(loadStoredState())}>Volver a intentar</button>
        </section>
      ) : (
        <Routes>
          <Route path="/" element={authenticated ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />} />
          <Route
            path="/login"
            element={authenticated
              ? <Navigate to="/dashboard" replace />
              : <LoginForm onLoggedIn={(nextState) => {
                setStored({ state: nextState, error: '' })
                navigate('/dashboard', { replace: true })
              }} />}
          />
          <Route
            path="/register"
            element={authenticated
              ? <Navigate to="/dashboard" replace />
              : <RegisterForm onRegistered={(nextState) => {
                setStored({ state: nextState, error: '' })
                navigate('/dashboard', { replace: true })
              }} />}
          />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute isAuthenticated={authenticated}>
                {authenticated && state?.user && (
                  <Dashboard
                    fullName={state.user.fullName}
                    userId={state.user.id}
                    userEmail={state.user.email}
                    balanceCents={state.wallet.balanceCents}
                    logoutError={logoutError}
                    onLogout={handleLogout}
                    onPaymentResult={handlePaymentResult}
                  />
                )}
              </ProtectedRoute>
            }
          />
          <Route path="*" element={authenticated ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />} />
        </Routes>
      )}
    </main>
  )
}

export default App
