// src/components/admin/Admin.jsx

import React, { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../contexts/ToastContext'
import { forceLamp } from '../../lib/api'

// ✅ Lazy load child components
const AdminUsers = lazy(() => import('./AdminUsers'))
const AdminVouchers = lazy(() => import('./AdminVouchers'))
const AdminBookings = lazy(() => import('./AdminBookings'))
const AdminMasterPin = lazy(() => import('./AdminMasterPin'))

// ✅ Loading fallback
function TabLoading() {
  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <div className="spinner" style={{ margin: '0 auto' }}></div>
      <p style={{ marginTop: '12px', color: 'var(--gray-500)', fontSize: '14px' }}>Memuat...</p>
    </div>
  )
}

// ✅ Device Status Component (memoized)
const DeviceStatus = React.memo(function DeviceStatus({ deviceStatus, onForceLamp }) {
  return (
    <div className="card" style={{ border: '2px solid var(--primary)', padding: '16px' }}>
      <div className="card-header" style={{ marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
        <span className="card-title" style={{ fontSize: '16px' }}>💡 Kontrol Lampu</span>
        <span className={`badge ${deviceStatus?.relay_state ? 'badge-active' : 'badge-cancelled'}`}>
          {deviceStatus?.relay_state ? '💡 ON' : '💡 OFF'}
        </span>
      </div>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <button 
          onClick={() => onForceLamp('on')} 
          className="btn btn-success" 
          style={{ 
            flex: 1, 
            minWidth: '80px',
            minHeight: '44px',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          💡 ON
        </button>
        <button 
          onClick={() => onForceLamp('off')} 
          className="btn btn-danger" 
          style={{ 
            flex: 1, 
            minWidth: '80px',
            minHeight: '44px',
            fontSize: '14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          💡 OFF
        </button>
      </div>
      <div style={{ marginTop: '10px', fontSize: '13px', color: 'var(--gray-500)' }}>
        Terakhir terlihat: {deviceStatus ? new Date(deviceStatus.last_seen).toLocaleString('id-ID') : '-'}
      </div>
    </div>
  )
})

export default function Admin() {
  const { user, isAdmin, signOut } = useAuth()
  const [bookings, setBookings] = useState([])
  const [stats, setStats] = useState({ pending: 0, today: 0, active: 0, total: 0 })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [deviceStatus, setDeviceStatus] = useState(null)
  const navigate = useNavigate()
  const { showToast } = useToast()

  // ✅ Redirect if not admin
  useEffect(() => {
    if (!isAdmin) {
      navigate('/dashboard')
    }
  }, [isAdmin, navigate])

  // ✅ Load data with proper error handling
  const loadDeviceStatus = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('device_status')
        .select('*')
        .eq('device_mac', 'AA:BB:CC:DD:EE:FF')
        .maybeSingle()
      setDeviceStatus(data)
    } catch (error) {
      console.error('Error loading device status:', error)
    }
  }, [])

  const loadBookings = useCallback(async (showRefresh = false) => {
    if (showRefresh) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }

    try {
      const { data, error } = await supabase
        .from('bookings')
        .select('*, profiles(display_name, full_name, email, phone, block, house_number)')
        .order('start_time', { ascending: false })
        .limit(100)

      if (error) {
        showToast('❌ Gagal memuat bookings: ' + error.message, 'error')
        return
      }

      if (data) {
        setBookings(data)
        
        const today = new Date().toDateString()
        const todayBookings = data.filter(b => new Date(b.start_time).toDateString() === today)
        const active = data.filter(b => b.status === 'active' || b.status === 'pending')
        const pending = data.filter(b => b.status === 'pending')

        setStats({
          pending: pending.length,
          today: todayBookings.length,
          active: active.length,
          total: data.length,
        })
      }
    } catch (error) {
      console.error('Error loading bookings:', error)
      showToast('❌ Gagal memuat bookings', 'error')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [showToast])

  // ✅ Load all data in parallel
  const loadAllData = useCallback(async () => {
    try {
      await Promise.all([
        loadBookings(),
        loadDeviceStatus(),
      ])
    } catch (error) {
      console.error('Error loading data:', error)
      showToast('❌ Gagal memuat data', 'error')
    }
  }, [loadBookings, loadDeviceStatus, showToast])

  // ✅ Initial load with cleanup
  useEffect(() => {
    let isMounted = true
    let loadTimeout = null

    const init = async () => {
      if (isMounted) {
        await loadAllData()
      }
    }

    loadTimeout = setTimeout(init, 100)

    return () => {
      isMounted = false
      if (loadTimeout) {
        clearTimeout(loadTimeout)
      }
    }
  }, [loadAllData])

  // ✅ Memoized handlers
  const handleForceLamp = useCallback(async (state) => {
    try {
      await forceLamp(state)
      showToast(`💡 Lampu ${state === 'on' ? 'ON' : 'OFF'}`, 'success')
      loadDeviceStatus()
    } catch (error) {
      showToast('❌ ' + error.message, 'error')
    }
  }, [showToast, loadDeviceStatus])

  const handleRefresh = useCallback(() => {
    if (!refreshing && !loading) {
      loadBookings(true)
    }
  }, [loadBookings, refreshing, loading])

  const handleBookVenue = useCallback(() => {
    navigate('/booking')
  }, [navigate])

  const handleSignOut = useCallback(async () => {
    try {
      await signOut()
      navigate('/login')
    } catch (error) {
      showToast('❌ Gagal keluar: ' + error.message, 'error')
    }
  }, [signOut, navigate, showToast])

  const statsDisplay = useMemo(() => stats, [stats])

  // ✅ Show loading state
  if (loading) {
    return (
      <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div>
          <div className="spinner" style={{ margin: '0 auto' }}></div>
          <p style={{ marginTop: '16px', color: 'var(--gray-500)', textAlign: 'center' }}>Memuat dashboard admin...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container" style={{ paddingTop: '12px', paddingBottom: '40px' }}>
      {/* ===== HEADER ===== */}
      <div className="header" style={{ padding: '0 0 12px 0', borderBottom: '2px solid var(--gray-100)' }}>
        <div className="header-content" style={{ padding: 0 }}>
          <div className="logo">
            <span className="logo-icon">🏛️</span>
            <div>
              <span className="logo-text" style={{ fontSize: '16px' }}>Gedung Serbaguna BJP</span>
              <span className="logo-sub">👑 Panel Admin</span>
            </div>
          </div>
          <button 
            onClick={handleSignOut} 
            className="btn btn-outline btn-sm" 
            style={{ 
              width: 'auto', 
              minHeight: '36px', 
              padding: '4px 14px', 
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            Keluar
          </button>
        </div>
      </div>

      {/* ===== BOOK VENUE BUTTON ===== */}
      <div style={{ marginBottom: '14px' }}>
        <button 
          onClick={handleBookVenue} 
          className="btn btn-primary" 
          style={{ 
            width: '100%', 
            minHeight: '48px',
            fontSize: '15px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          📖 Book Venue
        </button>
      </div>

      {/* ===== STATS ===== */}
      <div className="stats-grid" style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(4, 1fr)', 
        gap: '8px',
        marginBottom: '14px'
      }}>
        <div className="stat-card" style={{ padding: '12px 6px' }}>
          <div className="stat-number" style={{ fontSize: '20px' }}>{statsDisplay.pending}</div>
          <div className="stat-label" style={{ fontSize: '10px' }}>Menunggu</div>
        </div>
        <div className="stat-card" style={{ padding: '12px 6px' }}>
          <div className="stat-number" style={{ fontSize: '20px' }}>{statsDisplay.today}</div>
          <div className="stat-label" style={{ fontSize: '10px' }}>Hari Ini</div>
        </div>
        <div className="stat-card" style={{ padding: '12px 6px' }}>
          <div className="stat-number" style={{ fontSize: '20px', color: 'var(--success)' }}>{statsDisplay.active}</div>
          <div className="stat-label" style={{ fontSize: '10px' }}>Aktif</div>
        </div>
        <div className="stat-card" style={{ padding: '12px 6px' }}>
          <div className="stat-number" style={{ fontSize: '20px' }}>{statsDisplay.total}</div>
          <div className="stat-label" style={{ fontSize: '10px' }}>Total</div>
        </div>
      </div>

      {/* ===== LAZY LOADED COMPONENTS ===== */}
      <Suspense fallback={<TabLoading />}>
        <AdminUsers />
      </Suspense>

      <Suspense fallback={<TabLoading />}>
        <div className="card" style={{ border: '2px solid var(--warning)', padding: '16px' }}>
          <AdminMasterPin />
        </div>
      </Suspense>

      <Suspense fallback={<TabLoading />}>
        <AdminVouchers />
      </Suspense>

      {/* ===== DEVICE STATUS ===== */}
      <DeviceStatus 
        deviceStatus={deviceStatus} 
        onForceLamp={handleForceLamp} 
      />

      {/* ===== BOOKINGS ===== */}
      <div className="card" style={{ padding: '16px' }}>
        <div className="card-header" style={{ marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
          <span className="card-title" style={{ fontSize: '16px' }}>📋 Semua Pesanan</span>
          <button 
            onClick={handleRefresh} 
            className="btn btn-outline btn-sm" 
            style={{ 
              width: 'auto', 
              minHeight: '34px', 
              padding: '4px 14px', 
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px'
            }}
            disabled={refreshing}
          >
            {refreshing ? '⏳' : '🔄'} Refresh
          </button>
        </div>
        <Suspense fallback={<TabLoading />}>
          <AdminBookings bookings={bookings} onRefresh={() => loadBookings()} />
        </Suspense>
      </div>
    </div>
  )
}
