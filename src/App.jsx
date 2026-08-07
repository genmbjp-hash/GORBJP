import React, { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import ProtectedRoute from './components/ProtectedRoute'
import GuestRoute from './components/GuestRoute'
import PaymentStatus from './components/PaymentStatus'

// Lazy load components
const Login = lazy(() => import('./components/Login'))
const Signup = lazy(() => import('./components/Signup'))
const Dashboard = lazy(() => import('./components/dashboard/Dashboard'))
const Booking = lazy(() => import('./components/booking/Booking'))
const Admin = lazy(() => import('./components/admin/Admin'))
const LandingPage = lazy(() => import('./components/LandingPage'))

function LoadingSpinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <div className="spinner"></div>
    </div>
  )
}

function App() {
  const { loading } = useAuth()

  if (loading) {
    return <LoadingSpinner />
  }

  return (
    <div className="app">
      <Suspense fallback={<LoadingSpinner />}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          
          <Route path="/login" element={
            <GuestRoute>
              <Login />
            </GuestRoute>
          } />
          
          <Route path="/signup" element={
            <GuestRoute>
              <Signup />
            </GuestRoute>
          } />

          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />

          <Route path="/booking" element={
            <ProtectedRoute>
              <Booking />
            </ProtectedRoute>
          } />

          <Route path="/admin" element={
            <ProtectedRoute requireAdmin>
              <Admin />
            </ProtectedRoute>
          } />

          <Route path="/payment-status" element={<PaymentStatus />} />
        </Routes>
      </Suspense>
    </div>
  )
}

export default App
