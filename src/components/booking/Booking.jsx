import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'

export default function Booking() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      navigate('/login')
      return
    }
    setLoading(false)
  }, [user])

  if (!user || loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div className="spinner"></div>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#F8FAFC',
      padding: '16px',
      paddingBottom: '140px',
      maxWidth: '480px',
      margin: '0 auto'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#1E40AF' }}>🏛️ Booking</h1>
        <button
          onClick={() => navigate('/dashboard')}
          style={{
            padding: '8px 16px',
            background: 'transparent',
            border: '2px solid #E2E8F0',
            borderRadius: '8px',
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: '14px'
          }}
        >
          ← Kembali
        </button>
      </div>

      <div style={{
        background: 'white',
        borderRadius: '12px',
        padding: '20px',
        boxShadow: '0 4px 24px rgba(30,64,175,0.10)',
        marginBottom: '16px'
      }}>
        <p style={{ color: '#64748B' }}>
          📅 {selectedDate.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
        <p style={{ color: '#1E293B', fontWeight: 600, marginTop: '8px' }}>
          ✅ Booking page is loading correctly!
        </p>
        <p style={{ color: '#94A3B8', fontSize: '14px', marginTop: '4px' }}>
          The slot list will be added back after we confirm the page loads.
        </p>
      </div>
    </div>
  )
}
