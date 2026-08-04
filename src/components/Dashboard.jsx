import React, { useState, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase, getUserBookings, signOut, completeExpiredBookings, cancelPendingBooking } from '../lib/supabase'
import { useToast } from '../App'

export default function Dashboard({ user, profile }) {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [pendingBooking, setPendingBooking] = useState(null)
  const [timeLeft, setTimeLeft] = useState(0)
  const timerRef = useRef(null)
  const navigate = useNavigate()
  const showToast = useToast()

  async function loadBookings() {
    setLoading(true)
    const { data } = await getUserBookings(user.id)
    setBookings(data || [])
    
    const pending = data?.find(b => b.status === 'pending')
    setPendingBooking(pending || null)
    
    if (pending) {
      const deadline = new Date(pending.payment_deadline)
      const remaining = Math.max(0, Math.floor((deadline - new Date()) / 1000))
      setTimeLeft(remaining)
    }
    
    setLoading(false)
  }

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [])

  // Load bookings on mount
  useEffect(() => {
    const updateAndLoad = async () => {
      await completeExpiredBookings()
      await loadBookings()
    }
    updateAndLoad()
  }, [])

  // Timer for pending booking (runs separately, doesn't trigger full re-render)
  useEffect(() => {
    // Clear existing timer
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }

    if (!pendingBooking) {
      setTimeLeft(0)
      return
    }

    // Initial time
    const deadline = new Date(pendingBooking.payment_deadline)
    const initialRemaining = Math.max(0, Math.floor((deadline - new Date()) / 1000))
    setTimeLeft(initialRemaining)

    // Start interval
    timerRef.current = setInterval(() => {
      const deadline = new Date(pendingBooking.payment_deadline)
      const remaining = Math.max(0, Math.floor((deadline - new Date()) / 1000))
      setTimeLeft(remaining)
      
      if (remaining === 0) {
        clearInterval(timerRef.current)
        timerRef.current = null
        // Reload bookings to update status
        loadBookings()
      }
    }, 1000)

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [pendingBooking?.id]) // Only re-run when pending booking ID changes

  async function handleCancelPending() {
    if (!pendingBooking) return
    if (!confirm('Apakah Anda yakin ingin membatalkan pesanan ini?')) return

    const { error } = await cancelPendingBooking(pendingBooking.id)
    if (error) {
      showToast('❌ Gagal membatalkan: ' + error.message, 'error')
      return
    }
    showToast('✅ Pesanan dibatalkan', 'success')
    loadBookings()
  }

  async function handleCancel(bookingId) {
    if (!confirm('Apakah Anda yakin ingin membatalkan pesanan ini?')) return

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
  }

  async function handleLogout() {
    await signOut()
    navigate('/login')
  }

  function formatTimeLeft(seconds) {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

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

  const total = bookings.length
  const active = bookings.filter(b => b.status === 'active').length
  const upcoming = bookings.filter(b => b.status === 'pending').length

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
          <div className="stat-number">{total}</div>
          <div className="stat-label">Total Pesanan</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{active}</div>
          <div className="stat-label">Aktif</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{upcoming}</div>
          <div className="stat-label">Menunggu</div>
        </div>
      </div>

      <Link to="/booking" className="btn btn-primary" style={{ marginBottom: '16px' }}>
        📖 Pesan Slot Baru
      </Link>

      <div className="card">
        <div className="card-header">
          <span className="card-title">📋 Pesanan Saya</span>
          <button onClick={loadBookings} className="btn btn-outline btn-sm" style={{ width: 'auto', minHeight: '32px', padding: '4px 12px', fontSize: '12px' }}>
            🔄 Refresh
          </button>
        </div>

        {loading ? (
          <div className="loading"><div className="spinner"></div></div>
        ) : bookings.length === 0 ? (
          <p style={{ color: 'var(--gray-400)', textAlign: 'center', padding: '20px' }}>Belum ada pesanan</p>
        ) : (
          bookings.map(b => {
            const isPending = b.status === 'pending'
            
            return (
              <div key={b.id} className="booking-item" style={{ 
                borderLeft: isPending ? '4px solid var(--warning)' : '4px solid transparent',
                paddingLeft: '12px'
              }}>
                <div className="booking-info">
                  <div className="booking-date">{formatDate(b.start_time)}</div>
                  <div className="booking-time">{formatTime(b.start_time)} - {formatTime(b.end_time)}</div>
                  <div style={{ marginTop: '4px' }}>
                    {getStatusBadge(b.status)}
                    {b.payment_status === 'paid' && (
  <span className="badge" style={{ marginLeft: '4px', background: '#D1FAE5', color: '#065F46' }}>💰 Dibayar</span>
)}
{b.payment_status === 'pending' && (
  <span className="badge" style={{ marginLeft: '4px', background: '#FEF3C7', color: '#92400E' }}>⏳ Menunggu Pembayaran</span>
)}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  {isPending ? (
                    <div>
                      <div style={{ fontSize: '14px', color: 'var(--warning)', fontWeight: 600 }}>
                        ⏰ {formatTimeLeft(timeLeft)}
                      </div>
                      <button
                        onClick={() => navigate('/payment', { 
                          state: { 
                            bookingId: b.id,
                            date: b.start_time.split('T')[0],
                            slot: {
                              hour: new Date(b.start_time).getHours(),
                              startTime: b.start_time,
                              endTime: b.end_time
                            },
                            duration: b.duration_hours,
                            price: b.duration_hours * 30000
                          }
                        })}
                        className="btn btn-warning btn-sm"
                        style={{ width: 'auto', minHeight: '32px', padding: '4px 12px', fontSize: '12px', marginTop: '4px' }}
                        disabled={timeLeft <= 0}
                      >
                        {timeLeft > 0 ? '💳 Lanjutkan Pembayaran' : '⏰ Kadaluarsa'}
                      </button>
                      <button
                        onClick={handleCancelPending}
                        className="btn btn-danger btn-sm"
                        style={{ width: 'auto', minHeight: '32px', padding: '4px 12px', fontSize: '12px', marginTop: '4px' }}
                      >
                        ❌ Batal
                      </button>
                    </div>
                  ) : (
                    <div>
                      {b.pin && <div className="booking-pin">{b.pin}</div>}
                      {(b.status === 'active' || b.status === 'pending') && (
                        <button
                          onClick={() => handleCancel(b.id)}
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
        )}
      </div>
    </div>
  )
}
