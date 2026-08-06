import React, { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'

// Lazy load components
const Login = lazy(() => import('./components/Login'))
const Signup = lazy(() => import('./components/Signup'))
const Dashboard = lazy(() => import('./components/dashboard/Dashboard'))
const Booking = lazy(() => import('./components/booking/Booking'))
const Admin = lazy(() => import('./components/admin/Admin'))
const LandingPage = lazy(() => import('./components/LandingPage'))

// Loading Spinner Component
function LoadingSpinner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <div className="spinner"></div>
    </div>
  )
}

function App() {
  // ✅ Use auth from context (removed local auth state)
  const { user, profile, loading } = useAuth()

  // ✅ Route protection logic
  const isApproved = user && profile?.status === 'approved'
  const isAdmin = isApproved && profile?.role === 'admin'
  const isCustomer = isApproved && profile?.role !== 'admin'

  if (loading) {
    return <LoadingSpinner />
  }

  return (
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
    </div>
  )
}

export default App
