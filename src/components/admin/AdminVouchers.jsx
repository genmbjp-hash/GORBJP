// src/components/admin/AdminVouchers.jsx

import React, { useState, useEffect, useCallback, useMemo, memo } from 'react'
import { supabase } from '../../lib/supabase'
import { createVoucher, deactivateVoucher, deleteVoucher, updateVoucher } from '../../lib/api'
import { useToast } from '../../hooks/useToast'

// ============================================
// VOUCHER ITEM COMPONENT (memoized)
// ============================================

const VoucherItem = memo(function VoucherItem({ 
  voucher, 
  onEdit, 
  onToggleActive, 
  onDelete,
  getDiscountLabel 
}) {
  return (
    <div className="user-item">
      <div>
        <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--primary)' }}>
          {voucher.code}
          {voucher.is_used && (
            <span style={{ marginLeft: '8px', fontSize: '12px', color: 'var(--success)' }}>
              ✅ Digunakan
            </span>
          )}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--gray-500)' }}>
          {voucher.description || 'Tidak ada deskripsi'} • <strong>{getDiscountLabel(voucher)}</strong>
          {' • '}Digunakan: {voucher.used_count || 0}/{voucher.max_uses === 0 ? '∞' : voucher.max_uses}
          {voucher.min_duration > 1 && ` • Min ${voucher.min_duration} jam`}
          {voucher.max_duration && ` • Max ${voucher.max_duration} jam`}
          {voucher.expires_at && ` • Exp: ${new Date(voucher.expires_at).toLocaleDateString('id-ID')}`}
        </div>
        <div style={{ marginTop: '4px' }}>
          <span className={`badge ${voucher.active ? 'badge-active' : 'badge-cancelled'}`}>
            {voucher.active ? '✅ Active' : '❌ Inactive'}
          </span>
          {voucher.expires_at && new Date(voucher.expires_at) < new Date() && (
            <span className="badge" style={{ marginLeft: '4px', background: '#FEE2E2', color: '#991B1B' }}>
              ⏰ Expired
            </span>
          )}
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <button 
          onClick={() => onEdit(voucher)} 
          className="btn btn-primary btn-sm" 
          style={{ width: 'auto', minHeight: '30px', padding: '4px 12px', fontSize: '12px' }}
        >
          ✏️ Edit
        </button>
        {voucher.active ? (
          <button 
            onClick={() => onToggleActive(voucher.id, false)} 
            className="btn btn-warning btn-sm" 
            style={{ width: 'auto', minHeight: '30px', padding: '4px 12px', fontSize: '12px' }}
          >
            Nonaktifkan
          </button>
        ) : (
          <button 
            onClick={() => onToggleActive(voucher.id, true)} 
            className="btn btn-success btn-sm" 
            style={{ width: 'auto', minHeight: '30px', padding: '4px 12px', fontSize: '12px' }}
          >
            Aktifkan
          </button>
        )}
        <button 
          onClick={() => onDelete(voucher.id)} 
          className="btn btn-danger btn-sm" 
          style={{ width: 'auto', minHeight: '30px', padding: '4px 12px', fontSize: '12px' }}
        >
          Hapus
        </button>
      </div>
    </div>
  )
})

// ============================================
// MAIN COMPONENT
// ============================================

export default function AdminVouchers() {
  const [vouchers, setVouchers] = useState([])
  const [filteredVouchers, setFilteredVouchers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterActive, setFilterActive] = useState('all') // 'all', 'active', 'inactive'
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({
    code: '',
    description: '',
    discount_type: 'percentage',
    discount_value: '',
    max_uses: '',
    expires_at: '',
    min_duration: 1,
    max_duration: '',
  })
  const { showToast } = useToast()

  // ✅ Load vouchers with error handling
  const loadVouchers = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('vouchers')
        .select('*, profiles(full_name, display_name)')
        .order('created_at', { ascending: false })

      if (error) {
        showToast('❌ Gagal memuat voucher: ' + error.message, 'error')
        setVouchers([])
        setFilteredVouchers([])
      } else {
        setVouchers(data || [])
        setFilteredVouchers(data || [])
      }
    } catch (error) {
      showToast('❌ Gagal memuat voucher', 'error')
      setVouchers([])
      setFilteredVouchers([])
    } finally {
      setLoading(false)
    }
  }, [showToast])

  // ✅ Initial load
  useEffect(() => {
    loadVouchers()
  }, [loadVouchers])

  // ✅ Search and filter
  useEffect(() => {
    const timer = setTimeout(() => {
      let filtered = vouchers

      // Search filter
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase().trim()
        filtered = filtered.filter(v => 
          v.code.toLowerCase().includes(term) ||
          v.description?.toLowerCase().includes(term)
        )
      }

      // Active status filter
      if (filterActive === 'active') {
        filtered = filtered.filter(v => v.active === true)
      } else if (filterActive === 'inactive') {
        filtered = filtered.filter(v => v.active === false)
      }

      setFilteredVouchers(filtered)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchTerm, filterActive, vouchers])

  // ✅ Get discount label
  const getDiscountLabel = useCallback((v) => {
    if (v.discount_type === 'free') return 'Gratis (Rp 1)'
    if (v.discount_type === 'percentage') return `${v.discount_value}%`
    if (v.discount_type === 'fixed') return `Rp ${v.discount_value.toLocaleString()}`
    return '-'
  }, [])

  // ✅ Open create modal
  const openCreate = useCallback(() => {
    setEditing(null)
    setForm({
      code: '',
      description: '',
      discount_type: 'percentage',
      discount_value: '',
      max_uses: '',
      expires_at: '',
      min_duration: 1,
      max_duration: '',
    })
    setShowModal(true)
  }, [])

  // ✅ Open edit modal
  const openEdit = useCallback((voucher) => {
    setEditing(voucher)
    setForm({
      code: voucher.code,
      description: voucher.description || '',
      discount_type: voucher.discount_type,
      discount_value: voucher.discount_value || '',
      max_uses: voucher.max_uses || '',
      expires_at: voucher.expires_at ? voucher.expires_at.split('T')[0] : '',
      min_duration: voucher.min_duration || 1,
      max_duration: voucher.max_duration || '',
    })
    setShowModal(true)
  }, [])

  // ✅ Handle save (create/update)
  const handleSave = useCallback(async () => {
    const { code, description, discount_type, discount_value, max_uses, expires_at, min_duration, max_duration } = form

    if (!code.trim()) {
      showToast('❌ Masukkan kode voucher', 'error')
      return
    }

    if (discount_type !== 'free' && !discount_value) {
      showToast('❌ Masukkan nilai diskon', 'error')
      return
    }

    const payload = {
      code: code.toUpperCase(),
      description: description || null,
      discount_type,
      discount_value: discount_type === 'free' ? 0 : parseInt(discount_value),
      max_uses: max_uses ? parseInt(max_uses) : 0,
      expires_at: expires_at || null,
      min_duration: parseInt(min_duration) || 1,
      max_duration: max_duration ? parseInt(max_duration) : null,
    }

    try {
      if (editing) {
        await updateVoucher(editing.id, payload)
        showToast('✅ Voucher updated: ' + code, 'success')
      } else {
        await createVoucher(payload)
        showToast('✅ Voucher created: ' + code, 'success')
      }
      setShowModal(false)
      loadVouchers()
    } catch (error) {
      showToast('❌ ' + error.message, 'error')
    }
  }, [form, editing, showToast, loadVouchers])

  // ✅ Toggle active status
  const handleToggleActive = useCallback(async (voucherId, active) => {
    const action = active ? 'Aktifkan' : 'Nonaktifkan'
    if (!confirm(`${action} voucher ini?`)) return

    try {
      if (active) {
        await updateVoucher(voucherId, { active: true })
      } else {
        await deactivateVoucher(voucherId)
      }
      loadVouchers()
      showToast(`✅ Voucher ${action.toLowerCase()}`, 'success')
    } catch (error) {
      showToast('❌ ' + error.message, 'error')
    }
  }, [showToast, loadVouchers])

  // ✅ Delete voucher
  const handleDelete = useCallback(async (voucherId) => {
    if (!confirm('Hapus voucher ini?')) return

    try {
      await deleteVoucher(voucherId)
      loadVouchers()
      showToast('✅ Voucher dihapus', 'success')
    } catch (error) {
      showToast('❌ ' + error.message, 'error')
    }
  }, [showToast, loadVouchers])

  // ✅ Refresh handler
  const handleRefresh = useCallback(() => {
    if (!loading) {
      loadVouchers()
    }
  }, [loadVouchers, loading])

  // ✅ Memoized stats
  const stats = useMemo(() => ({
    total: vouchers.length,
    active: vouchers.filter(v => v.active).length,
    inactive: vouchers.filter(v => !v.active).length,
    filtered: filteredVouchers.length,
  }), [vouchers, filteredVouchers])

  // ✅ Memoized form handlers
  const handleFormChange = useCallback((field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }, [])

  const handleSearchChange = useCallback((e) => {
    setSearchTerm(e.target.value)
  }, [])

  const handleFilterChange = useCallback((value) => {
    setFilterActive(value)
  }, [])

  return (
    <div className="card" style={{ border: '2px solid var(--primary)' }}>
      <div className="card-header">
        <span className="card-title">🎫 Voucher Management</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span className="badge badge-active">{stats.active} Aktif</span>
          <span className="badge badge-cancelled">{stats.inactive} Nonaktif</span>
          <button 
            onClick={handleRefresh} 
            className="btn btn-outline btn-sm" 
            style={{ width: 'auto', minHeight: '32px', padding: '4px 12px', fontSize: '12px' }}
            disabled={loading}
          >
            {loading ? '⏳' : '🔄'}
          </button>
          <button 
            onClick={openCreate} 
            className="btn btn-primary btn-sm" 
            style={{ width: 'auto', minHeight: '36px', padding: '4px 16px' }}
          >
            + Create Voucher
          </button>
        </div>
      </div>

      {/* ✅ Search and filter bar */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--gray-100)' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="🔍 Cari voucher (kode/deskripsi)..."
            value={searchTerm}
            onChange={handleSearchChange}
            style={{
              flex: 1,
              minWidth: '200px',
              padding: '8px 12px',
              border: '2px solid var(--gray-200)',
              borderRadius: '8px',
              fontSize: '14px',
              fontFamily: 'inherit',
              outline: 'none',
              transition: 'border-color 0.2s'
            }}
            onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
            onBlur={(e) => e.target.style.borderColor = 'var(--gray-200)'}
          />
          <select
            value={filterActive}
            onChange={(e) => handleFilterChange(e.target.value)}
            style={{
              padding: '8px 12px',
              border: '2px solid var(--gray-200)',
              borderRadius: '8px',
              fontSize: '14px',
              fontFamily: 'inherit',
              background: 'white',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="all">Semua ({stats.total})</option>
            <option value="active">Aktif ({stats.active})</option>
            <option value="inactive">Nonaktif ({stats.inactive})</option>
          </select>
        </div>
        {searchTerm && (
          <div style={{ marginTop: '4px', fontSize: '12px', color: 'var(--gray-500)' }}>
            Menampilkan {stats.filtered} dari {stats.total} voucher
          </div>
        )}
      </div>

      {/* ✅ Voucher list */}
      <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <div className="spinner" style={{ margin: '0 auto' }}></div>
            <p style={{ marginTop: '12px', color: 'var(--gray-500)', fontSize: '14px' }}>Memuat voucher...</p>
          </div>
        ) : filteredVouchers.length === 0 ? (
          <p style={{ color: 'var(--gray-400)', textAlign: 'center', padding: '20px' }}>
            {searchTerm ? '🔍 Tidak ada voucher yang cocok' : 'Belum ada voucher'}
          </p>
        ) : (
          filteredVouchers.map(v => (
            <VoucherItem
              key={v.id}
              voucher={v}
              onEdit={openEdit}
              onToggleActive={handleToggleActive}
              onDelete={handleDelete}
              getDiscountLabel={getDiscountLabel}
            />
          ))
        )}
      </div>

      {/* ✅ Create/Edit Modal */}
      {showModal && (
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
            <h3 style={{ marginBottom: '16px' }}>{editing ? '✏️ Edit Voucher' : '🎫 Create Voucher'}</h3>
            
            <div className="form-group">
              <label className="form-label">Kode Voucher *</label>
              <input 
                type="text" 
                value={form.code} 
                onChange={(e) => handleFormChange('code', e.target.value.toUpperCase())} 
                placeholder="e.g., TEAM2026" 
                className="form-input" 
                style={{ textTransform: 'uppercase' }} 
                disabled={!!editing} 
              />
            </div>

            <div className="form-group">
              <label className="form-label">Deskripsi (opsional)</label>
              <input 
                type="text" 
                value={form.description} 
                onChange={(e) => handleFormChange('description', e.target.value)} 
                placeholder="e.g., Team Free Use" 
                className="form-input" 
              />
            </div>

            <div className="form-group">
              <label className="form-label">Tipe Diskon *</label>
              <select 
                value={form.discount_type} 
                onChange={(e) => {
                  handleFormChange('discount_type', e.target.value)
                  if (e.target.value === 'free') {
                    handleFormChange('discount_value', '')
                  }
                }} 
                className="form-input"
              >
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed Amount (Rp)</option>
                <option value="free">Free (Rp 1)</option>
              </select>
            </div>

            {form.discount_type !== 'free' && (
              <div className="form-group">
                <label className="form-label">
                  {form.discount_type === 'percentage' ? 'Nilai Diskon (%) *' : 'Nilai Diskon (Rp) *'}
                </label>
                <input 
                  type="number" 
                  value={form.discount_value} 
                  onChange={(e) => handleFormChange('discount_value', e.target.value)} 
                  placeholder={form.discount_type === 'percentage' ? 'e.g., 50' : 'e.g., 20000'} 
                  className="form-input" 
                  min="1" 
                />
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Batas Penggunaan (0 = unlimited)</label>
              <input 
                type="number" 
                value={form.max_uses} 
                onChange={(e) => handleFormChange('max_uses', e.target.value)} 
                placeholder="0" 
                className="form-input" 
                min="0" 
              />
            </div>

            <div className="form-group">
              <label className="form-label">Tanggal Kadaluarsa (opsional)</label>
              <input 
                type="date" 
                value={form.expires_at} 
                onChange={(e) => handleFormChange('expires_at', e.target.value)} 
                className="form-input" 
              />
            </div>

            <div className="form-group">
              <label className="form-label">Durasi Minimal (jam)</label>
              <input 
                type="number" 
                value={form.min_duration} 
                onChange={(e) => handleFormChange('min_duration', parseInt(e.target.value) || 1)} 
                className="form-input" 
                min="1" 
              />
            </div>

            <div className="form-group">
              <label className="form-label">Durasi Maksimal (jam) (0 = unlimited)</label>
              <input 
                type="number" 
                value={form.max_duration} 
                onChange={(e) => handleFormChange('max_duration', e.target.value)} 
                placeholder="0" 
                className="form-input" 
                min="0" 
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <button onClick={() => setShowModal(false)} className="btn btn-outline" style={{ flex: 1 }}>Batal</button>
              <button onClick={handleSave} className="btn btn-primary" style={{ flex: 1 }}>
                {editing ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
