import { useState } from 'react'
import RegisterForm from './RegisterForm.tsx'
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
  const { state, error } = stored

  return (
    <main>
      <h1>Sistema de caracoles</h1>
      {error ? (
        <section aria-label="Error de almacenamiento">
          <p className="error" role="alert">{error}</p>
          <button type="button" onClick={() => setStored(loadStoredState())}>Volver a intentar</button>
        </section>
      ) : state?.user && state.session?.userId === state.user.id ? (
        <section aria-labelledby="welcome-title">
          <h2 id="welcome-title">Bienvenido, {state.user.fullName}</h2>
          <p>Tu sesión local está activa.</p>
          <p className="balance">Saldo: ${(state.wallet.balanceCents / 100).toFixed(2)}</p>
        </section>
      ) : state?.user ? (
        <section aria-label="Cuenta existente">
          <h2>Ya existe una cuenta local</h2>
          <p>No hay una sesión activa. El inicio de sesión estará disponible en un próximo incremento.</p>
        </section>
      ) : (
        <RegisterForm onRegistered={(registered) => setStored({ state: registered, error: '' })} />
      )}
    </main>
  )
}

export default App
