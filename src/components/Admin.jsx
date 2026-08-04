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
  signOut,
  completeExpiredBookings,
  createVoucher,
  getVouchers,
  updateVoucher,
  deactivateVoucher,
  deleteVoucher,
  supabase
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

  // Voucher state
  const [vouchers, setVouchers] = useState([])
  const [showVoucherModal, setShowVoucherModal] = useState(false)
  const [editingVoucher, setEditingVoucher] = useState(null)
  const [voucherForm, setVoucherForm] = useState({
    code: '',
    description: '',
    discount_type: 'percentage',
    discount_value: '',
    max_uses: '',
    expires_at: '',
    min_duration: 1,
    max_duration: ''
  })

  const navigate = useNavigate()
  const showToast = useToast()

  useEffect(() => {
    const updateAndLoad = async () => {
      await completeExpiredBookings()
      await loadAllData()
      await loadVouchers()
    }
    updateAndLoad()

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

  async function loadVouchers() {
    const { data } = await getVouchers()
    setVouchers(data || [])
  }

  // ============================================
  // VOUCHER FUNCTIONS
  // ============================================

  function openCreateVoucher() {
    setEditingVoucher(null)
    setVoucherForm({
      code: '',
      description: '',
      discount_type: 'percentage',
      discount_value: '',
      max_uses: '',
      expires_at: '',
      min_duration: 1,
      max_duration: ''
    })
    setShowVoucherModal(true)
  }

  function openEditVoucher(voucher) {
    setEditingVoucher(voucher)
    setVoucherForm({
      code: voucher.code,
      description: voucher.description || '',
      discount_type: voucher.discount_type,
      discount_value: voucher.discount_value || '',
      max_uses: voucher.max_uses || '',
      expires_at: voucher.expires_at ? voucher.expires_at.split('T')[0] : '',
      min_duration: voucher.min_duration || 1,
      max_duration: voucher.max_duration || ''
    })
    setShowVoucherModal(true)
  }

  async function handleSaveVoucher() {
    const { code, description, discount_type, discount_value, max_uses, expires_at, min_duration, max_duration } = voucherForm

    if (!code.trim()) {
      showToast('❌ Masukkan kode voucher', 'error')
      return
    }

    if (!discount_type) {
      showToast('❌ Pilih tipe diskon', 'error')
      return
    }

    if (discount_type !== 'free' && !discount_value) {
      showToast('❌ Masukkan nilai diskon', 'error')
      return
    }

    if (discount_type === 'percentage' && (discount_value < 1 || discount_value > 100)) {
      showToast('❌ Persentase diskon harus 1-100', 'error')
      return
    }

    if (editingVoucher) {
      const { error } = await updateVoucher(editingVoucher.id, {
        code: code.toUpperCase(),
        description: description || null,
        discount_type,
        discount_value: discount_type === 'free' ? 0 : parseInt(discount_value),
        max_uses: max_uses ? parseInt(max_uses) : 0,
        expires_at: expires_at || null,
        min_duration: parseInt(min_duration) || 1,
        max_duration: max_duration ? parseInt(max_duration) : null
      })
      if (error) {
        showToast('❌ ' + error.message, 'error')
        return
      }
      showToast('✅ Voucher updated: ' + code, 'success')
    } else {
      const { error } = await createVoucher(
        code,
        description,
        discount_type,
        discount_type === 'free' ? 0 : parseInt(discount_value),
        max_uses ? parseInt(max_uses) : 0,
        expires_at || null,
        parseInt(min_duration) || 1,
        max_duration ? parseInt(max_duration) : null,
        user.id
      )
      if (error) {
        showToast('❌ ' + error.message, 'error')
        return
      }
      showToast('✅ Voucher created: ' + code, 'success')
    }

    setShowVoucherModal(false)
    loadVouchers()
  }

  function getDiscountLabel(voucher) {
    if (voucher.discount_type === 'free') return 'Gratis (100%)'
    if (voucher.discount_type === 'percentage') return `${voucher.discount_value}%`
    if (voucher.discount_type === 'fixed') return `Rp ${voucher.discount_value.toLocaleString()}`
    return '-'
  }

  // ============================================
  // USER FUNCTIONS
  // ============================================

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

  // ============================================
  // MASTER PIN FUNCTIONS
  // ============================================

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

  // ============================================
  // DEVICE FUNCTIONS
  // ============================================

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

  // ============================================
  // PAYMENT FUNCTIONS
  // ============================================

  async function handleConfirmPayment(bookingId) {
    if (!confirm('Konfirmasi pembayaran untuk booking ini?')) return
    
    const { data: pinData, error: pinError } = await supabase.rpc('generate_pin')
    if (pinError) {
      showToast('❌ Gagal generate PIN: ' + pinError.message, 'error')
      return
    }

    const { error } = await supabase
      .from('bookings')
      .update({
        status: 'active',
        pin: pinData,
        payment_status: 'paid',
        admin_confirmed_at: new Date().toISOString()
      })
      .eq('id', bookingId)

    if (error) {
      showToast('❌ Gagal konfirmasi: ' + error.message, 'error')
    } else {
      showToast('✅ Pembayaran dikonfirmasi! PIN: ' + pinData, 'success')
      loadAllBookings()
    }
  }

  async function handleCancelBooking(bookingId) {
    if (!confirm('Batalkan booking ini?')) return

    const { error } = await supabase
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', bookingId)

    if (error) {
      showToast('❌ Gagal membatalkan: ' + error.message, 'error')
    } else {
      showToast('✅ Booking dibatalkan', 'success')
      loadAllBookings()
    }
  }

  // ============================================
  // LOGOUT
  // ============================================

  async function handleLogout() {
    await signOut()
    navigate('/login')
  }

  // ============================================
  // FORMATTERS
  // ============================================

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
      'free': { bg: '#E0E7FF', color: '#3730A3', label: '🆓 Gratis' },
      'paid': { bg: '#D1FAE5', color: '#065F46', label: '💰 Dibayar' },
      'pending': { bg: '#FEF3C7', color: '#92400E', label: '⏳ Pending' },
      'failed': { bg: '#FEE2E2', color: '#991B1B', label: '❌ Gagal' },
      'expired': { bg: '#FEE2E2', color: '#991B1B', label: '⏰ Expired' },
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

      {/* Book Venue Button */}
      <div style={{ marginBottom: '16px' }}>
        <button onClick={() => navigate('/booking')} className="btn btn-primary" style={{ width: '100%' }}>
          📖 Book Venue
        </button>
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
                <div className="user-name">
                  {u.display_name || u.full_name || 'Unknown'}
                  <span style={{ fontSize: '11px', color: 'var(--gray-400)', marginLeft: '8px' }}>
                    (Nama lengkap: {u.full_name})
                  </span>
                </div>
                <div className="user-email">{u.email}</div>
                <div style={{ fontSize: '12px', color: 'var(--gray-500)' }}>
                  📞 {u.phone || '-'} • Blok {u.block || '-'} No. {u.house_number || '-'}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--gray-400)', marginTop: '4px' }}>
                  Daftar: {formatDate(u.created_at)}
                </div>
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

      {/* Voucher Management */}
      <div className="card" style={{ border: '2px solid var(--primary)' }}>
        <div className="card-header">
          <span className="card-title">🎫 Voucher Management</span>
          <button 
            onClick={openCreateVoucher} 
            className="btn btn-primary btn-sm"
            style={{ width: 'auto', minHeight: '36px', padding: '4px 16px' }}
          >
            + Create Voucher
          </button>
        </div>
        
        {vouchers.length === 0 ? (
          <p style={{ color: 'var(--gray-400)', textAlign: 'center', padding: '20px' }}>Belum ada voucher</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {vouchers.map(v => (
              <div key={v.id} className="user-item">
                <div>
                  <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--primary)' }}>
                    {v.code}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--gray-500)' }}>
                    {v.description || 'Tidak ada deskripsi'}
                    {' • '}
                    <strong>{getDiscountLabel(v)}</strong>
                    {' • '}
                    Digunakan: {v.used_count || 0}/{v.max_uses === 0 ? '∞' : v.max_uses}
                    {v.min_duration > 1 && ` • Min ${v.min_duration} jam`}
                    {v.max_duration && ` • Max ${v.max_duration} jam`}
                    {v.expires_at && ` • Exp: ${new Date(v.expires_at).toLocaleDateString('id-ID')}`}
                  </div>
                  <div style={{ marginTop: '4px' }}>
                    <span className={`badge ${v.active ? 'badge-active' : 'badge-cancelled'}`}>
                      {v.active ? '✅ Active' : '❌ Inactive'}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button 
                    onClick={() => openEditVoucher(v)}
                    className="btn btn-primary btn-sm"
                    style={{ width: 'auto', minHeight: '30px', padding: '4px 12px', fontSize: '12px' }}
                  >
                    ✏️ Edit
                  </button>
                  {v.active && (
                    <button 
                      onClick={async () => {
                        if (confirm('Nonaktifkan voucher ini?')) {
                          await deactivateVoucher(v.id)
                          loadVouchers()
                          showToast('✅ Voucher dinonaktifkan', 'success')
                        }
                      }}
                      className="btn btn-warning btn-sm"
                      style={{ width: 'auto', minHeight: '30px', padding: '4px 12px', fontSize: '12px' }}
                    >
                      Nonaktifkan
                    </button>
                  )}
                  {!v.active && (
                    <button 
                      onClick={async () => {
                        if (confirm('Aktifkan voucher ini?')) {
                          await updateVoucher(v.id, { active: true })
                          loadVouchers()
                          showToast('✅ Voucher diaktifkan', 'success')
                        }
                      }}
                      className="btn btn-success btn-sm"
                      style={{ width: 'auto', minHeight: '30px', padding: '4px 12px', fontSize: '12px' }}
                    >
                      Aktifkan
                    </button>
                  )}
                  <button 
                    onClick={async () => {
                      if (confirm('Hapus voucher ini?')) {
                        await deleteVoucher(v.id)
                        loadVouchers()
                        showToast('✅ Voucher dihapus', 'success')
                      }
                    }}
                    className="btn btn-danger btn-sm"
                    style={{ width: 'auto', minHeight: '30px', padding: '4px 12px', fontSize: '12px' }}
                  >
                    Hapus
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Voucher Modal */}
      {showVoucherModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999,
          padding: '16px',
          overflow: 'auto'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '500px',
            width: '100%',
            maxHeight: '90vh',
            overflow: 'auto'
          }}>
            <h3 style={{ marginBottom: '16px' }}>
              {editingVoucher ? '✏️ Edit Voucher' : '🎫 Create Voucher'}
            </h3>
            
            <div className="form-group">
              <label className="form-label">Kode Voucher *</label>
              <input
                type="text"
                value={voucherForm.code}
                onChange={(e) => setVoucherForm({ ...voucherForm, code: e.target.value.toUpperCase() })}
                placeholder="e.g., TEAM2026"
                className="form-input"
                style={{ textTransform: 'uppercase' }}
                disabled={!!editingVoucher}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Deskripsi (opsional)</label>
              <input
                type="text"
                value={voucherForm.description}
                onChange={(e) => setVoucherForm({ ...voucherForm, description: e.target.value })}
                placeholder="e.g., Team Free Use"
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Tipe Diskon *</label>
              <select
                value={voucherForm.discount_type}
                onChange={(e) => {
                  setVoucherForm({ 
                    ...voucherForm, 
                    discount_type: e.target.value,
                    discount_value: e.target.value === 'free' ? '' : voucherForm.discount_value
                  })
                }}
                className="form-input"
              >
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed Amount (Rp)</option>
                <option value="free">Free (100%)</option>
              </select>
            </div>

            {voucherForm.discount_type !== 'free' && (
              <div className="form-group">
                <label className="form-label">
                  {voucherForm.discount_type === 'percentage' ? 'Nilai Diskon (%) *' : 'Nilai Diskon (Rp) *'}
                </label>
                <input
                  type="number"
                  value={voucherForm.discount_value}
                  onChange={(e) => setVoucherForm({ ...voucherForm, discount_value: e.target.value })}
                  placeholder={voucherForm.discount_type === 'percentage' ? 'e.g., 50' : 'e.g., 20000'}
                  className="form-input"
                  min="1"
                />
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Batas Penggunaan (0 = unlimited)</label>
              <input
                type="number"
                value={voucherForm.max_uses}
                onChange={(e) => setVoucherForm({ ...voucherForm, max_uses: e.target.value })}
                placeholder="0"
                className="form-input"
                min="0"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Tanggal Kadaluarsa (opsional)</label>
              <input
                type="date"
                value={voucherForm.expires_at}
                onChange={(e) => setVoucherForm({ ...voucherForm, expires_at: e.target.value })}
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Durasi Minimal (jam)</label>
              <input
                type="number"
                value={voucherForm.min_duration}
                onChange={(e) => setVoucherForm({ ...voucherForm, min_duration: parseInt(e.target.value) || 1 })}
                className="form-input"
                min="1"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Durasi Maksimal (jam) (0 = unlimited)</label>
              <input
                type="number"
                value={voucherForm.max_duration}
                onChange={(e) => setVoucherForm({ ...voucherForm, max_duration: e.target.value })}
                placeholder="0"
                className="form-input"
                min="0"
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <button onClick={() => setShowVoucherModal(false)} className="btn btn-outline" style={{ flex: 1 }}>
                Batal
              </button>
              <button onClick={handleSaveVoucher} className="btn btn-primary" style={{ flex: 1 }}>
                {editingVoucher ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Pending Bookings (Manual Payment) */}
            {bookings.filter(b => b.status === 'pending' && b.payment_status === 'pending').length > 0 && (
              <>
                <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--warning)', marginTop: '8px' }}>
                  ⏳ Menunggu Konfirmasi Pembayaran
                </h4>
                {bookings.filter(b => b.status === 'pending' && b.payment_status === 'pending').map(b => (
                  <div key={b.id} className="booking-item" style={{ background: '#FEF3C7', borderRadius: '8px', padding: '12px 16px' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '14px' }}>
                        {b.profiles?.display_name || b.profiles?.full_name || 'Unknown'}
                        <span style={{ fontWeight: 400, color: 'var(--gray-500)', fontSize: '12px' }}> {b.profiles?.email || ''}</span>
                      </div>
                      <div style={{ fontSize: '13px', color: 'var(--gray-600)' }}>
                        {formatDate(b.start_time)} {formatTime(b.start_time)} - {formatTime(b.end_time)}
                      </div>
                      <div style={{ marginTop: '4px' }}>
                        {getStatusBadge(b.status)}
                        {getPaymentBadge(b.payment_status || 'pending')}
                        <span style={{ marginLeft: '8px', fontWeight: 600, color: 'var(--primary)' }}>
                          Rp {b.price?.toLocaleString() || 0}
                        </span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <button 
                        onClick={() => handleConfirmPayment(b.id)}
                        className="btn btn-success btn-sm"
                        style={{ width: 'auto', minHeight: '32px', padding: '4px 12px', fontSize: '12px' }}
                      >
                        ✅ Confirm Payment
                      </button>
                      <button 
                        onClick={() => handleCancelBooking(b.id)}
                        className="btn btn-danger btn-sm"
                        style={{ width: 'auto', minHeight: '32px', padding: '4px 12px', fontSize: '12px' }}
                      >
                        ❌ Cancel
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* All Other Bookings */}
            <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--gray-500)', marginTop: '8px' }}>
              📋 Semua Pesanan
            </h4>
            {bookings.filter(b => !(b.status === 'pending' && b.payment_status === 'pending')).slice(0, 20).map(b => (
              <div key={b.id} className="booking-item">
                <div>
                  <div style={{ fontWeight: 600, fontSize: '14px' }}>
                    {b.profiles?.display_name || b.profiles?.full_name || 'Unknown'}
                    <span style={{ fontWeight: 400, color: 'var(--gray-500)', fontSize: '12px' }}> {b.profiles?.email || ''}</span>
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--gray-600)' }}>
                    {formatDate(b.start_time)} {formatTime(b.start_time)} - {formatTime(b.end_time)}
                  </div>
                  <div style={{ marginTop: '4px' }}>
                    {getStatusBadge(b.status)}
                    {getPaymentBadge(b.payment_status || 'free')}
                    {b.voucher_id && (
                      <span className="badge" style={{ marginLeft: '4px', background: '#E0E7FF', color: '#3730A3' }}>
                        🎫 Voucher
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--primary)', letterSpacing: '2px' }}>
                    {b.pin || '-'}
                  </div>
                </div>
              </div>
            ))}
          </div>
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
