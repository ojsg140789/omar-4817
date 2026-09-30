import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {/* El router envuelve toda la aplicación para resolver las rutas en el navegador. */}
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
