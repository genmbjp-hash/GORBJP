import React, { useState, useEffect, useCallback, useMemo, memo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase, getUserBookings, signOut, completeExpiredBookings, cancelPendingBooking } from '../../lib/supabase'
import { useToast } from '../../hooks/useToast'

// ============================================
// HELPER FUNCTIONS (moved outside component)
// ============================================

function formatDate(dateStr) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

function formatTime(dateStr) {
  const d = new Date(dateStr)
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

function getStatusBadge(status) {
  const map = {
    'pending': 'badge-pending',
    'active': 'badge-active',
    'completed': 'badge-completed',
    'cancelled': 'badge-cancelled'
  }
  const labels = {
    'pending': '⏳ Menunggu Pembayaran',
    'active': '✅ Aktif',
    'completed': '✔️ Selesai',
    'cancelled': '❌ Dibatalkan'
  }
  return <span className={`badge ${map[status] || ''}`}>{labels[status] || status}</span>
}

function getPaymentBadge(paymentStatus, discountApplied) {
  if (discountApplied > 0) {
    return <span className="badge" style={{ marginLeft: '4px', background: '#E0E7FF', color: '#3730A3' }}>🎫 Voucher</span>
  }
  const styles = {
    'free': { bg: '#E0E7FF', color: '#3730A3', label: '🆓 Gratis' },
    'paid': { bg: '#D1FAE5', color: '#065F46', label: '💰 Dibayar' },
    'pending': { bg: '#FEF3C7', color: '#92400E', label: '⏳ Pending' },
  }
  const style = styles[paymentStatus] || styles['pending']
  return (
    <span className="badge" style={{ marginLeft: '4px', background: style.bg, color: style.color }}>
      {style.label}
    </span>
  )
}

// ============================================
// BOOKING ITEM COMPONENT (memoized)
// ============================================

const BookingItem = memo(function BookingItem({ 
  booking, 
  onCancel, 
  onCancelPending, 
  onContinuePayment,
  isPending 
}) {
  const hasVoucher = booking.voucher_id && booking.discount_applied > 0
  
  return (
    <div className="booking-item" style={{ 
      borderLeft: isPending ? '4px solid var(--warning)' : '4px solid transparent',
      paddingLeft: '12px'
    }}>
      <div className="booking-info">
        <div className="booking-date">{formatDate(booking.start_time)}</div>
        <div className="booking-time">{formatTime(booking.start_time)} - {formatTime(booking.end_time)}</div>
        <div style={{ marginTop: '4px' }}>
          {getStatusBadge(booking.status)}
          {getPaymentBadge(booking.payment_status, booking.discount_applied)}
          {hasVoucher && booking.discount_applied > 0 && (
            <span style={{ marginLeft: '4px', fontSize: '11px', color: 'var(--gray-500)' }}>
              (Diskon Rp {booking.discount_applied.toLocaleString()})
            </span>
          )}
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        {isPending ? (
          <div>
            <button
              onClick={() => onContinuePayment(booking)}
              className="btn btn-warning btn-sm"
              style={{ width: 'auto', minHeight: '32px', padding: '4px 12px', fontSize: '12px', marginTop: '4px' }}
            >
              📖 Lanjutkan Pembayaran
            </button>
            <button
              onClick={() => onCancelPending(booking.id)}
              className="btn btn-danger btn-sm"
              style={{ width: 'auto', minHeight: '32px', padding: '4px 12px', fontSize: '12px', marginTop: '4px' }}
            >
              ❌ Batal
            </button>
          </div>
        ) : (
          <div>
            {booking.pin && <div className="booking-pin">{booking.pin}</div>}
            {(booking.status === 'active' || booking.status === 'pending') && (
              <button
                onClick={() => onCancel(booking.id)}
                className="btn btn-danger btn-sm"
                style={{ width: 'auto', minHeight: '32px', padding: '4px 12px', fontSize: '12px', marginTop: '4px' }}
              >
                Batal
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
})

// ============================================
// MAIN DASHBOARD COMPONENT
// ============================================

export default function Dashboard({ user, profile }) {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const navigate = useNavigate()
  const showToast = useToast()

  // ✅ Memoized loadBookings with useCallback
  const loadBookings = useCallback(async (showRefresh = false) => {
    if (showRefresh) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }
    
    try {
      const { data, error } = await getUserBookings(user.id)
      if (error) {
        showToast('❌ Gagal memuat pesanan: ' + error.message, 'error')
        setBookings([])
      } else {
        setBookings(data || [])
      }
    } catch (error) {
      showToast('❌ Gagal memuat pesanan', 'error')
      setBookings([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [user.id, showToast])

  // ✅ Initial load with cleanup
  useEffect(() => {
    let isMounted = true
    let loadTimeout = null

    const init = async () => {
      try {
        await completeExpiredBookings()
        if (isMounted) {
          await loadBookings()
        }
      } catch (error) {
        console.error('Init error:', error)
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    // Debounce initial load
    loadTimeout = setTimeout(init, 100)

    return () => {
      isMounted = false
      if (loadTimeout) {
        clearTimeout(loadTimeout)
      }
    }
  }, [loadBookings])

  // ✅ Memoized stats
  const stats = useMemo(() => {
    const total = bookings.length
    const active = bookings.filter(b => b.status === 'active').length
    const pending = bookings.filter(b => b.status === 'pending').length
    return { total, active, pending }
  }, [bookings])

  // ✅ Memoized pending bookings
  const pendingBookings = useMemo(() => {
    return bookings.filter(b => b.status === 'pending')
  }, [bookings])

  // ✅ Cancel functions with useCallback
  const handleCancel = useCallback(async (bookingId) => {
    if (!confirm('Apakah Anda yakin ingin membatalkan pesanan ini?')) return

    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status: 'cancelled' })
        .eq('id', bookingId)
        .eq('user_id', user.id)

      if (error) {
        showToast('❌ Gagal membatalkan: ' + error.message, 'error')
        return
      }

      showToast('✅ Pesanan dibatalkan', 'success')
      loadBookings()
    } catch (error) {
      showToast('❌ Gagal membatalkan pesanan', 'error')
    }
  }, [user.id, showToast, loadBookings])

  // ✅ Fixed: Cancel specific pending booking, not just the first one
  const handleCancelPending = useCallback(async (bookingId) => {
    if (!confirm('Apakah Anda yakin ingin membatalkan pesanan ini?')) return

    try {
      const { error } = await cancelPendingBooking(bookingId)
      if (error) {
        showToast('❌ Gagal membatalkan: ' + error.message, 'error')
        return
      }
      showToast('✅ Pesanan dibatalkan', 'success')
      loadBookings()
    } catch (error) {
      showToast('❌ Gagal membatalkan pesanan', 'error')
    }
  }, [showToast, loadBookings])

  const handleContinuePayment = useCallback((booking) => {
    navigate('/booking', { state: { pendingBooking: booking } })
  }, [navigate])

  const handleLogout = useCallback(async () => {
    try {
      await signOut()
      navigate('/login')
    } catch (error) {
      showToast('❌ Gagal keluar: ' + error.message, 'error')
    }
  }, [navigate, showToast])

  const handleRefresh = useCallback(() => {
    if (!refreshing && !loading) {
      loadBookings(true)
    }
  }, [loadBookings, refreshing, loading])

  // ✅ Show loading state
  if (loading) {
    return (
      <div className="container" style={{ paddingTop: '16px' }}>
        <div className="header" style={{ padding: '0 0 16px 0', borderBottom: '2px solid var(--gray-100)' }}>
          <div className="header-content" style={{ padding: 0 }}>
            <div className="logo">
              <span className="logo-icon">🏛️</span>
              <div>
                <span className="logo-text">Gedung Serbaguna BJP</span>
                <span className="logo-sub">Sistem Pemesanan</span>
              </div>
            </div>
          </div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <div className="spinner" style={{ margin: '0 auto' }}></div>
          <p style={{ marginTop: '16px', color: 'var(--gray-500)' }}>Memuat dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container" style={{ paddingTop: '16px' }}>
      <div className="header" style={{ padding: '0 0 16px 0', borderBottom: '2px solid var(--gray-100)' }}>
        <div className="header-content" style={{ padding: 0 }}>
          <div className="logo">
            <span className="logo-icon">🏛️</span>
            <div>
              <span className="logo-text">Gedung Serbaguna BJP</span>
              <span className="logo-sub">Sistem Pemesanan</span>
            </div>
          </div>
          <button onClick={handleLogout} className="btn btn-outline btn-sm" style={{ width: 'auto', minHeight: '36px', padding: '4px 16px' }}>
            Keluar
          </button>
        </div>
      </div>

      <div className="card" style={{ background: 'var(--primary)', color: 'white', border: 'none' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 700 }}>👋 Selamat datang, {profile.display_name || profile.full_name || 'User'}!</h2>
        <p style={{ fontSize: '14px', opacity: 0.9 }}>Pesan venue dan dapatkan PIN Anda</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-number">{stats.total}</div>
          <div className="stat-label">Total Pesanan</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{stats.active}</div>
          <div className="stat-label">Aktif</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{stats.pending}</div>
          <div className="stat-label">Menunggu</div>
        </div>
      </div>

      <Link to="/booking" className="btn btn-primary" style={{ marginBottom: '16px' }}>
        📖 Pesan Slot Baru
      </Link>

      <div className="card">
        <div className="card-header">
          <span className="card-title">📋 Pesanan Saya</span>
          <button 
            onClick={handleRefresh} 
            className="btn btn-outline btn-sm" 
            style={{ width: 'auto', minHeight: '32px', padding: '4px 12px', fontSize: '12px' }}
            disabled={refreshing}
          >
            {refreshing ? '⏳' : '🔄'} Refresh
          </button>
        </div>

        {bookings.length === 0 ? (
          <p style={{ color: 'var(--gray-400)', textAlign: 'center', padding: '20px' }}>Belum ada pesanan</p>
        ) : (
          bookings.map(b => {
            const isPending = b.status === 'pending'
            return (
              <BookingItem
                key={b.id}
                booking={b}
                isPending={isPending}
                onCancel={handleCancel}
                onCancelPending={handleCancelPending}
                onContinuePayment={handleContinuePayment}
              />
            )
          })
        )}
      </div>
    </div>
  )
}
