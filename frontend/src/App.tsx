import { useState } from 'react'
import Dashboard from './dashboard/Dashboard.tsx'
import RegisterForm from './auth/RegisterForm.tsx'
import LoginForm from './auth/LoginForm.tsx'
import { logout } from './auth/auth.ts'
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

  function handleLogout() {
    setLogoutError('')
    try {
      const updated = logout()
      setStored({ state: updated, error: '' })
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
    <main>
      <h1>Sistema de caracoles</h1>
      {error ? (
        <section aria-label="Error de almacenamiento">
          <p className="error" role="alert">{error}</p>
          <button type="button" onClick={() => setStored(loadStoredState())}>Volver a intentar</button>
        </section>
      ) : state?.user && state.session?.userId === state.user.id ? (
        <Dashboard
          fullName={state.user.fullName}
          userId={state.user.id}
          userEmail={state.user.email}
          balanceCents={state.wallet.balanceCents}
          logoutError={logoutError}
          onLogout={handleLogout}
          onPaymentResult={handlePaymentResult}
        />
      ) : state?.user ? (
        <LoginForm onLoggedIn={(authenticated) => setStored({ state: authenticated, error: '' })} />
      ) : (
        <RegisterForm onRegistered={(registered) => setStored({ state: registered, error: '' })} />
      )}
    </main>
  )
}

export default App
