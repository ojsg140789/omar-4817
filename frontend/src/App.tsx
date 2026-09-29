import { useState } from 'react'
import Dashboard from './Dashboard.tsx'
import RegisterForm from './RegisterForm.tsx'
import LoginForm from './LoginForm.tsx'
import { logout } from './auth.ts'
import { readAppState, type AppState } from './storage.ts'

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
          balanceCents={state.wallet.balanceCents}
          logoutError={logoutError}
          onLogout={handleLogout}
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
