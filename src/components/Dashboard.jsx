import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase, getUserBookings, signOut } from '../lib/supabase'
import { useToast } from '../App'

export default function Dashboard({ user, profile }) {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const showToast = useToast()

  useEffect(() => { loadBookings() }, [])

  async function loadBookings() {
    const { data } = await getUserBookings(user.id)
    setBookings(data || [])
    setLoading(false)
  }

  async function handleCancel(bookingId) {
    if (!confirm('Apakah Anda yakin ingin membatalkan pesanan ini?')) return
    const { error } = await supabase
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', bookingId)
      .eq('user_id', user.id)

    if (error) {
      showToast('❌ ' + error.message, 'error')
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
    const map = { 'pending': 'badge-pending', 'active': 'badge-active', 'completed': 'badge-completed', 'cancelled': 'badge-cancelled' }
    const labels = { 'pending': 'Menunggu', 'active': 'Aktif', 'completed': 'Selesai', 'cancelled': 'Dibatalkan' }
    return <span className={`badge ${map[status] || ''}`}>{labels[status] || status}</span>
  }

  const total = bookings.length
  const active = bookings.filter(b => b.status === 'active' || b.status === 'pending').length
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
          <button onClick={handleLogout} className="btn btn-outline btn-sm" style={{ width: 'auto', minHeight: '36px', padding: '4px 16px' }}>Keluar</button>
        </div>
      </div>

      <div className="card" style={{ background: 'var(--primary)', color: 'white', border: 'none' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 700 }}>👋 Selamat datang, {profile.full_name}!</h2>
        <p style={{ fontSize: '14px', opacity: 0.9 }}>Pesan venue dan dapatkan PIN Anda</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card"><div className="stat-number">{total}</div><div className="stat-label">Total Pesanan</div></div>
        <div className="stat-card"><div className="stat-number">{active}</div><div className="stat-label">Aktif Hari Ini</div></div>
        <div className="stat-card"><div className="stat-number">{upcoming}</div><div className="stat-label">Akan Datang</div></div>
      </div>

      <Link to="/booking" className="btn btn-primary" style={{ marginBottom: '16px' }}>📖 Pesan Slot Baru</Link>

      <div className="card">
        <div className="card-header"><span className="card-title">📋 Pesanan Terbaru</span></div>
        {loading ? (
          <div className="loading"><div className="spinner"></div></div>
        ) : bookings.length === 0 ? (
          <p style={{ color: 'var(--gray-400)', textAlign: 'center', padding: '20px' }}>Belum ada pesanan</p>
        ) : (
          bookings.slice(0, 5).map(b => (
            <div key={b.id} className="booking-item">
              <div className="booking-info">
                <div className="booking-date">{formatDate(b.start_time)}</div>
                <div className="booking-time">{formatTime(b.start_time)} - {formatTime(b.end_time)}</div>
                <div style={{ marginTop: '4px' }}>{getStatusBadge(b.status)}</div>
              </div>
              <div>
                <div className="booking-pin">{b.pin}</div>
                {(b.status === 'pending' || b.status === 'active') && (
                  <button onClick={() => handleCancel(b.id)} className="btn btn-danger btn-sm" style={{ width: 'auto', minHeight: '32px', padding: '4px 12px', fontSize: '12px' }}>Batal</button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
