import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase, getUserBookings, signOut, completeExpiredBookings, cancelPendingBooking } from '../../lib/supabase'
import { useToast } from '../../hooks/useToast'

export default function Dashboard({ user, profile }) {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const showToast = useToast()

  async function loadBookings() {
    setLoading(true)
    const { data } = await getUserBookings(user.id)
    setBookings(data || [])
    setLoading(false)
  }

  useEffect(() => {
    const updateAndLoad = async () => {
      await completeExpiredBookings()
      await loadBookings()
    }
    updateAndLoad()
  }, [])

  async function handleCancelPending() {
    const pendingBooking = bookings.find(b => b.status === 'pending')
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

  const total = bookings.length
  const active = bookings.filter(b => b.status === 'active').length
  const pending = bookings.filter(b => b.status === 'pending').length

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
          <div className="stat-number">{pending}</div>
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
            const hasVoucher = b.voucher_id && b.discount_applied > 0
            
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
                    {getPaymentBadge(b.payment_status, b.discount_applied)}
                    {hasVoucher && b.discount_applied > 0 && (
                      <span style={{ marginLeft: '4px', fontSize: '11px', color: 'var(--gray-500)' }}>
                        (Diskon Rp {b.discount_applied.toLocaleString()})
                      </span>
                    )}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  {isPending ? (
                    <div>
                      <button
                        onClick={() => navigate('/booking')}
                        className="btn btn-warning btn-sm"
                        style={{ width: 'auto', minHeight: '32px', padding: '4px 12px', fontSize: '12px', marginTop: '4px' }}
                      >
                        📖 Lanjutkan Booking
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
