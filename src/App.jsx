import React, { useEffect, useState } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { supabase, getProfile } from './lib/supabase'

// Components
import Login from './components/Login'
import Signup from './components/Signup'
import Dashboard from './components/Dashboard'
import Booking from './components/Booking'
import Admin from './components/Admin'
import Checkout from './components/Checkout'
import Confirmation from './components/Confirmation'
import Payment from './components/Payment'
import PaymentSuccess from './components/PaymentSuccess'
import PaymentFailed from './components/PaymentFailed'

// Toast Context
const ToastContext = React.createContext()
export function useToast() {
  return React.useContext(ToastContext)
}

function App() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [toasts, setToasts] = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user)
        loadProfile(session.user.id)
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user)
        loadProfile(session.user.id)
      } else {
        setUser(null)
        setProfile(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function loadProfile(userId) {
    const { data } = await getProfile(userId)
    setProfile(data)
    setLoading(false)
  }

  function showToast(message, type = 'info') {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 4000)
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div className="spinner"></div>
      </div>
    )
  }

  return (
    <ToastContext.Provider value={showToast}>
      <div className="app">
        <Routes>
          <Route path="/" element={
            user && profile?.status === 'approved' ? (
              profile?.role === 'admin' ? <Navigate to="/admin" /> : <Navigate to="/dashboard" />
            ) : (
              <LandingPage user={user} profile={profile} />
            )
          } />
          <Route path="/login" element={
            user && profile?.status === 'approved' ? (
              profile?.role === 'admin' ? <Navigate to="/admin" /> : <Navigate to="/dashboard" />
            ) : (
              <Login />
            )
          } />
          <Route path="/signup" element={
            user ? <Navigate to="/" /> : <Signup />
          } />
          <Route path="/dashboard" element={
            user && profile?.status === 'approved' && profile?.role !== 'admin' ? (
              <Dashboard user={user} profile={profile} />
            ) : (
              <Navigate to="/" />
            )
          } />
          <Route path="/booking" element={
  user && profile?.status === 'approved' ? (
    <Booking user={user} />
  ) : (
    <Navigate to="/" />
  )
} />
          <Route path="/checkout" element={
  user && profile?.status === 'approved' && profile?.role !== 'admin' ? (
    <Checkout user={user} />
  ) : (
    <Navigate to="/" />
  )
} />
<Route path="/confirmation" element={
  user && profile?.status === 'approved' && profile?.role !== 'admin' ? (
    <Confirmation />
  ) : (
    <Navigate to="/" />
  )
} />
          <Route path="/admin" element={
            user && profile?.role === 'admin' ? (
              <Admin user={user} />
            ) : (
              <Navigate to="/" />
            )
          } />
          <Route path="/payment" element={
  user && profile?.status === 'approved' ? (
    <Payment user={user} />
  ) : (
    <Navigate to="/" />
  )
} />
<Route path="/payment-success" element={
  user && profile?.status === 'approved' ? (
    <PaymentSuccess />
  ) : (
    <Navigate to="/" />
  )
} />
<Route path="/payment-failed" element={
  user && profile?.status === 'approved' ? (
    <PaymentFailed />
  ) : (
    <Navigate to="/" />
  )
} />
        </Routes>

        <div className="toast-container">
          {toasts.map(toast => (
            <div key={toast.id} className={`toast toast-${toast.type}`}>
              {toast.message}
            </div>
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  )
}

function LandingPage({ user, profile }) {
  return (
    <div className="container" style={{ paddingTop: '40px' }}>
      <div className="card" style={{ background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)', color: 'white', border: 'none', textAlign: 'center', padding: '40px 24px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 800, marginBottom: '8px' }}>🏛️ Gedung Serbaguna BJP</h1>
        <p style={{ fontSize: '16px', opacity: 0.9 }}>Sewa venue dengan mudah, dapatkan PIN akses</p>
      </div>

      <div className="card">
        <h3 style={{ fontSize: '18px', fontWeight: 700, textAlign: 'center', color: 'var(--primary)', marginBottom: '16px' }}>📋 Cara Kerja</h3>
        <div className="how-it-works">
          <div className="hiw-step"><div className="hiw-number">1</div><div className="hiw-text">Daftar & Tunggu Approval</div></div>
          <div className="hiw-step"><div className="hiw-number">2</div><div className="hiw-text">Pilih Tanggal & Waktu</div></div>
          <div className="hiw-step"><div className="hiw-number">3</div><div className="hiw-text">Dapatkan PIN & Masuk</div></div>
        </div>
      </div>

      {user && profile?.status === 'pending' && (
        <div className="alert alert-warning">⏳ Akun Anda menunggu persetujuan admin.</div>
      )}
      {user && profile?.status === 'rejected' && (
        <div className="alert alert-error">❌ Akun Anda ditolak. Hubungi admin.</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
        <a href="/login" className="btn btn-primary">🔐 Masuk</a>
        <a href="/signup" className="btn btn-secondary">📝 Daftar</a>
      </div>

      <div style={{ textAlign: 'center', padding: '24px 0 16px', fontSize: '12px', color: 'var(--gray-400)' }}>
        © 2026 Gedung Serbaguna BJP
      </div>
    </div>
  )
}

export default App
