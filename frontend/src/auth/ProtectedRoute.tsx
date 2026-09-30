import type { ReactNode } from 'react'
import { Navigate } from 'react-router'

interface ProtectedRouteProps {
  isAuthenticated: boolean
  children: ReactNode
}

export default function ProtectedRoute({ isAuthenticated, children }: ProtectedRouteProps) {
  // Al redirigir antes de devolver children, Dashboard no llega a montarse sin sesión válida.
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return children
}
