import React, { useEffect, useState, lazy, Suspense, useCallback, useMemo } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { supabase, getProfile } from './lib/supabase'

// ✅ Lazy load components
const Login = lazy(() => import('./components/Login'))
const Signup = lazy(() => import('./components/Signup'))
const Dashboard = lazy(() => import('./components/dashboard/Dashboard'))
const Booking = lazy(() => import('./components/booking/Booking'))
const Admin = lazy(() => import('./components/admin/Admin'))
const LandingPage = lazy(() => import('./components/LandingPage')) // Move to separate file

// ✅ Toast Context
const ToastContext = React.createContext()
export function useToast() {
  return React.useContext(ToastContext)
}

// ✅ Loading Spinner Component
function LoadingSpinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <div className="spinner"></div>
    </div>
  )
}

function App() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [toasts, setToasts] = useState([])

  // ✅ Memoize loadProfile to prevent recreation
  const loadProfile = useCallback(async (userId) => {
    try {
      const { data } = await getProfile(userId)
      setProfile(data)
    } catch (error) {
      console.error('Error loading profile:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  // ✅ Handle session and auth state changes
  useEffect(() => {
    let isMounted = true

    const initSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (isMounted) {
          if (session?.user) {
            setUser(session.user)
            await loadProfile(session.user.id)
          } else {
            setLoading(false)
          }
        }
      } catch (error) {
        console.error('Session error:', error)
        if (isMounted) setLoading(false)
      }
    }

    initSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (isMounted) {
        if (session?.user) {
          setUser(session.user)
          await loadProfile(session.user.id)
        } else {
          setUser(null)
          setProfile(null)
          setLoading(false)
        }
      }
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [loadProfile]) // ✅ Added dependency

  // ✅ Memoize showToast to prevent recreation
  const showToast = useCallback((message, type = 'info') => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 4000)
  }, [])

  // ✅ Memoize context value
  const toastContextValue = useMemo(() => showToast, [showToast])

  // ✅ Memoize route protection logic
  const isApproved = user && profile?.status === 'approved'
  const isAdmin = isApproved && profile?.role === 'admin'
  const isCustomer = isApproved && profile?.role !== 'admin'

  if (loading) {
    return <LoadingSpinner />
  }

  return (
    <ToastContext.Provider value={toastContextValue}>
      <div className="app">
        <Suspense fallback={<LoadingSpinner />}>
          <Routes>
            <Route path="/" element={
              isApproved ? (
                isAdmin ? <Navigate to="/admin" /> : <Navigate to="/dashboard" />
              ) : (
                <LandingPage user={user} profile={profile} />
              )
            } />
            <Route path="/login" element={
              isApproved ? (
                isAdmin ? <Navigate to="/admin" /> : <Navigate to="/dashboard" />
              ) : (
                <Login />
              )
            } />
            <Route path="/signup" element={
              user ? <Navigate to="/" /> : <Signup />
            } />
            <Route path="/dashboard" element={
              isCustomer ? (
                <Dashboard user={user} profile={profile} />
              ) : (
                <Navigate to="/" />
              )
            } />
            <Route path="/booking" element={
              isApproved ? (
                <Booking user={user} />
              ) : (
                <Navigate to="/" />
              )
            } />
            <Route path="/admin" element={
              isAdmin ? (
                <Admin user={user} />
              ) : (
                <Navigate to="/" />
              )
            } />
          </Routes>
        </Suspense>

        <div className="toast-wrap">
          {toasts.map(toast => (
            <div key={toast.id} className={`toast ${toast.type}`}>
              {toast.message}
            </div>
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  )
}

export default App
