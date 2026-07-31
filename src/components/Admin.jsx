import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  getPendingUsers,
  approveUser,
  rejectUser,
  generateMasterPin,
  getActiveMasterPins,
  deactivateMasterPin,
  getDeviceStatus,
  forceLampOn,
  forceLampOff,
  getAllBookings,
  signOut
} from '../lib/supabase'
import { useToast } from '../App'

export default function Admin({ user }) {
  const [pendingUsers, setPendingUsers] = useState([])
  const [masterPins, setMasterPins] = useState([])
  const [deviceStatus, setDeviceStatus] = useState(null)
  const [bookings, setBookings] = useState([])
  const [stats, setStats] = useState({ pending: 0, today: 0, active: 0, total: 0 })
  const [masterDuration, setMasterDuration] = useState(8)
  const [masterPurpose, setMasterPurpose] = useState('')
  const [loading, setLoading] = useState(true)
  const [masterPinResult, setMasterPinResult] = useState(null)
  const [newBookingsCount, setNewBookingsCount] = useState(0)
  const navigate = useNavigate()
  const showToast = useToast()

  useEffect(() => {
    loadAllData()
    const interval = setInterval(() => {
      loadDeviceStatus()
      loadAllBookings()
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  async function loadAllData() {
    setLoading(true)
    await Promise.all([
      loadPendingUsers(),
      loadMasterPins(),
      loadDeviceStatus(),
      loadAllBookings()
    ])
    setLoading(false)
  }

  async function loadPendingUsers() {
    const { data } = await getPendingUsers()
    setPendingUsers(data || [])
  }

  async function loadMasterPins() {
    const { data } = await getActiveMasterPins()
    setMasterPins(data || [])
  }

  async function loadDeviceStatus() {
    const { data } = await getDeviceStatus()
    setDeviceStatus(data)
  }

  async function loadAllBookings() {
    const { data } = await getAllBookings()
    if (data) {
      setBookings(data)
      const today = new Date().toDateString()
      const todayBookings = data.filter(b => new Date(b.start_time).toDateString() === today)
      const active = data.filter(b => b.status === 'active' || b.status === 'pending')
      
      // Count new bookings (last 10 minutes)
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000)
      const newBookings = data.filter(b => new Date(b.created_at) > tenMinutesAgo)
      setNewBookingsCount(newBookings.length)
      
      setStats({
        pending: pendingUsers.length,
        today: todayBookings.length,
        active: active.length,
        total: data.length
      })
    }
  }

  async function handleApprove(userId) {
    if (!confirm('Setujui user ini?')) return
    const { error } = await approveUser(userId, user.id)
    if (error) {
      showToast('❌ ' + error.message, 'error')
      return
    }
    showToast('✅ User disetujui', 'success')
    loadPendingUsers()
    loadAllBookings()
  }

  async function handleReject(userId) {
    if (!confirm('Tolak user ini?')) return
    const { error } = await rejectUser(userId, user.id)
    if (error) {
      showToast('❌ ' + error.message, 'error')
      return
    }
    showToast('✅ User ditolak', 'success')
    loadPendingUsers()
    loadAllBookings()
  }

  async function handleGenerateMaster() {
    const duration = masterDuration || 8
    const purpose = masterPurpose || ''

    const { data, error } = await generateMasterPin(user.id, duration * 60, purpose)

    if (error) {
      showToast('❌ ' + error.message, 'error')
      return
    }

    setMasterPinResult(data)
    showToast('✅ PIN Master generated: ' + data.pin, 'success')
    loadMasterPins()
  }

  async function handleDeactivateMaster(pinId) {
    if (!confirm('Nonaktifkan PIN Master ini?')) return
    const { error } = await deactivateMasterPin(pinId, user.id)
    if (error) {
      showToast('❌ ' + error.message, 'error')
      return
    }
    showToast('✅ PIN Master dinonaktifkan', 'success')
    loadMasterPins()
  }

  async function handleForceOn() {
    const { error } = await forceLampOn(user.id)
    if (error) {
      showToast('❌ ' + error.message, 'error')
      return
    }
    showToast('💡 Lampu ON (paksa)', 'success')
    loadDeviceStatus()
  }

  async function handleForceOff() {
    const { error } = await forceLampOff(user.id)
    if (error) {
      showToast('❌ ' + error.message, 'error')
      return
    }
    showToast('💡 Lampu OFF (paksa)', 'success')
    loadDeviceStatus()
  }

  async function handleLogout() {
    await signOut()
    navigate('/login')
  }

  function formatDate(dateStr) {
    const d = new Date(dateStr)
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
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
      'cancelled': 'badge-cancelled',
      'approved': 'badge-approved',
      'rejected': 'badge-rejected'
    }
    const labels = {
      'pending': '⏳ Menunggu',
      'active': '✅ Aktif',
      'completed': '✔️ Selesai',
      'cancelled': '❌ Dibatalkan',
      'approved': '✅ Disetujui',
      'rejected': '❌ Ditolak'
    }
    return <span className={`badge ${map[status] || ''}`}>{labels[status] || status}</span>
  }

  function getPaymentBadge(paymentStatus) {
    const styles = {
      'free': { bg: '#FEF3C7', color: '#92400E', label: '🆓 Gratis' },
      'paid': { bg: '#D1FAE5', color: '#065F46', label: '💰 Dibayar' },
      'pending': { bg: '#FEE2E2', color: '#991B1B', label: '⏳ Pending' },
      'failed': { bg: '#FEE2E2', color: '#991B1B', label: '❌ Gagal' },
      'refunded': { bg: '#E0E7FF', color: '#3730A3', label: '↩️ Dikembalikan' }
    }
    const style = styles[paymentStatus] || styles['pending']
    return (
      <span className="badge" style={{ 
        marginLeft: '4px',
        background: style.bg,
        color: style.color
      }}>
        {style.label}
      </span>
    )
  }

  if (loading) {
    return (
      <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div className="spinner"></div>
      </div>
    )
  }

  return (
    <div className="container" style={{ paddingTop: '16px' }}>
      {/* Header */}
      <div className="header" style={{ padding: '0 0 16px 0', borderBottom: '2px solid var(--gray-100)' }}>
        <div className="header-content" style={{ padding: 0 }}>
          <div className="logo">
            <span className="logo-icon">🏛️</span>
            <div>
              <span className="logo-text">Gedung Serbaguna BJP</span>
              <span className="logo-sub">👑 Panel Admin</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {newBookingsCount > 0 && (
              <span className="badge badge-active" style={{ fontSize: '14px' }}>
                🔔 {newBookingsCount} baru
              </span>
            )}
            <button onClick={handleLogout} className="btn btn-outline btn-sm" style={{ width: 'auto', minHeight: '36px', padding: '4px 16px' }}>
              Keluar
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="stat-card">
          <div className="stat-number">{pendingUsers.length}</div>
          <div className="stat-label">User Menunggu</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{stats.today}</div>
          <div className="stat-label">Pesanan Hari Ini</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{stats.active}</div>
          <div className="stat-label">Aktif Sekarang</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{stats.total}</div>
          <div className="stat-label">Total Pesanan</div>
        </div>
      </div>

      {/* Pending Users */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">👤 Persetujuan User</span>
          <span className="badge badge-pending">{pendingUsers.length}</span>
        </div>
        {pendingUsers.length === 0 ? (
          <p style={{ color: 'var(--gray-400)', textAlign: 'center', padding: '20px' }}>✅ Tidak ada user menunggu</p>
        ) : (
          pendingUsers.map(u => (
            <div key={u.id} className="user-item">
              <div className="user-info">
                <div className="user-name">{u.full_name}</div>
                <div className="user-email">{u.email}</div>
                <div style={{ fontSize: '12px', color: 'var(--gray-400)' }}>Daftar: {formatDate(u.created_at)}</div>
              </div>
              <div className="user-actions">
                <button onClick={() => handleApprove(u.id)} className="btn btn-success btn-sm" style={{ width: 'auto', minHeight: '36px', padding: '4px 16px' }}>
                  ✅ Setujui
                </button>
                <button onClick={() => handleReject(u.id)} className="btn btn-danger btn-sm" style={{ width: 'auto', minHeight: '36px', padding: '4px 16px' }}>
                  ❌ Tolak
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Master PIN */}
      <div className="card" style={{ border: '2px solid var(--warning)' }}>
        <div className="card-header">
          <span className="card-title">🔑 Generate PIN Master</span>
          <span className="badge badge-warning">Admin Only</span>
        </div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '120px' }}>
            <label className="form-label" style={{ fontSize: '12px' }}>Durasi (jam)</label>
            <input
              type="number"
              className="form-input"
              value={masterDuration}
              onChange={(e) => setMasterDuration(parseInt(e.target.value) || 0)}
              min="1"
              max="24"
              style={{ padding: '10px 12px' }}
            />
          </div>
          <div style={{ flex: 2, minWidth: '150px' }}>
            <label className="form-label" style={{ fontSize: '12px' }}>Tujuan</label>
            <input
              type="text"
              className="form-input"
              placeholder="Maintenance, dll"
              value={masterPurpose}
              onChange={(e) => setMasterPurpose(e.target.value)}
              style={{ padding: '10px 12px' }}
            />
          </div>
        </div>
        <button onClick={handleGenerateMaster} className="btn btn-warning" style={{ marginTop: '12px' }}>
          🔑 Generate PIN Master
        </button>
        {masterPinResult && (
          <div style={{ marginTop: '12px', padding: '16px', background: 'var(--warning)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
            <p style={{ fontWeight: 600 }}>🔑 PIN Master</p>
            <p style={{ fontSize: '32px', fontWeight: 800, letterSpacing: '4px', color: 'var(--gray-900)' }}>{masterPinResult.pin}</p>
            <p style={{ fontSize: '14px' }}>Berlaku {masterDuration} jam (sampai {new Date(masterPinResult.expires_at).toLocaleString('id-ID')})</p>
          </div>
        )}
      </div>

      {/* Active Master PINs */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">🔐 PIN Master Aktif</span>
        </div>
        {masterPins.length === 0 ? (
          <p style={{ color: 'var(--gray-400)', textAlign: 'center', padding: '20px' }}>Tidak ada PIN Master aktif</p>
        ) : (
          masterPins.map(p => (
            <div key={p.id} className="booking-item">
              <div>
                <div style={{ fontWeight: 700, fontSize: '20px', color: 'var(--warning)' }}>{p.pin}</div>
                <div style={{ fontSize: '12px', color: 'var(--gray-500)' }}>
                  Berlaku sampai {new Date(p.expires_at).toLocaleString('id-ID')}
                  {p.purpose ? ` • ${p.purpose}` : ''}
                </div>
              </div>
              <button onClick={() => handleDeactivateMaster(p.id)} className="btn btn-danger btn-sm" style={{ width: 'auto', minHeight: '32px', padding: '4px 12px', fontSize: '12px' }}>
                Nonaktifkan
              </button>
            </div>
          ))
        )}
      </div>

      {/* Device Control */}
      <div className="card" style={{ border: '2px solid var(--primary)' }}>
        <div className="card-header">
          <span className="card-title">💡 Kontrol Lampu</span>
          <span className={`badge ${deviceStatus?.relay_state ? 'badge-active' : 'badge-cancelled'}`}>
            {deviceStatus?.relay_state ? '💡 ON' : '💡 OFF'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button onClick={handleForceOn} className="btn btn-success" style={{ flex: 1, minWidth: '100px' }}>
            💡 ON
          </button>
          <button onClick={handleForceOff} className="btn btn-danger" style={{ flex: 1, minWidth: '100px' }}>
            💡 OFF
          </button>
        </div>
        <div style={{ marginTop: '12px', fontSize: '14px', color: 'var(--gray-500)' }}>
          Terakhir terlihat: {deviceStatus ? new Date(deviceStatus.last_seen).toLocaleString('id-ID') : '-'}
        </div>
      </div>

      {/* All Bookings */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">📋 Semua Pesanan</span>
          {newBookingsCount > 0 && (
            <span className="badge badge-active" style={{ fontSize: '14px' }}>
              🔔 {newBookingsCount} baru
            </span>
          )}
        </div>
        {bookings.length === 0 ? (
          <p style={{ color: 'var(--gray-400)', textAlign: 'center', padding: '20px' }}>Belum ada pesanan</p>
        ) : (
          bookings.slice(0, 20).map(b => (
            <div key={b.id} className="booking-item">
              <div>
                <div style={{ fontWeight: 600, fontSize: '14px' }}>
                  {b.profiles?.full_name || 'Unknown'}
                  <span style={{ fontWeight: 400, color: 'var(--gray-500)', fontSize: '12px' }}> {b.profiles?.email || ''}</span>
                </div>
                <div style={{ fontSize: '13px', color: 'var(--gray-600)' }}>
                  {formatDate(b.start_time)} {formatTime(b.start_time)} - {formatTime(b.end_time)}
                </div>
                <div style={{ marginTop: '4px' }}>
                  {getStatusBadge(b.status)}
                  {getPaymentBadge(b.payment_status || 'free')}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--primary)', letterSpacing: '2px' }}>{b.pin}</div>
              </div>
            </div>
          ))
        )}
        {bookings.length > 20 && (
          <p style={{ textAlign: 'center', fontSize: '14px', color: 'var(--gray-400)', marginTop: '12px' }}>
            Menampilkan 20 dari {bookings.length} pesanan
          </p>
        )}
      </div>
    </div>
  )
}
