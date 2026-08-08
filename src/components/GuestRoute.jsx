import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function GuestRoute({ children }) {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div className="spinner"></div>
        <p style={{ marginTop: '16px', color: 'var(--gray-500)' }}>Memuat...</p>
      </div>
    )
  }

  // ✅ Only redirect if user is approved
  if (user && profile?.status === 'approved') {
    return <Navigate to={profile?.role === 'admin' ? '/admin' : '/dashboard'} replace />
  }

  return children
}
