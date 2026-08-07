import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function ProtectedRoute({ children, requireAdmin = false }) {
  const { user, profile, loading, isAdmin } = useAuth()

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div className="spinner"></div>
      </div>
    )
  }

  if (!user || profile?.status !== 'approved') {
    return <Navigate to="/" replace />
  }

  if (requireAdmin && !isAdmin) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}
