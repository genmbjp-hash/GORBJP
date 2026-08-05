// src/components/admin/AdminVouchers.jsx

import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { createVoucher, deactivateVoucher, deleteVoucher, updateVoucher } from '../../lib/api'
import { useToast } from '../../hooks/useToast'

export default function AdminVouchers() {
  const [vouchers, setVouchers] = useState([])
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

  useEffect(() => {
    loadVouchers()
  }, [])

  async function loadVouchers() {
    const { data } = await supabase
      .from('vouchers')
      .select('*, profiles(full_name, display_name)')
      .order('created_at', { ascending: false })
    setVouchers(data || [])
  }

  function openCreate() {
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
  }

  function openEdit(voucher) {
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
  }

  async function handleSave() {
    const { code, description, discount_type, discount_value, max_uses, expires_at, min_duration, max_duration } = form

    if (!code.trim()) {
      showToast('❌ Masukkan kode voucher', 'error')
      return
    }

    if (discount_type !== 'free' && !discount_value) {
      showToast('❌ Masukkan nilai diskon', 'error')
      return
    }

    try {
      if (editing) {
        await updateVoucher(editing.id, {
          code: code.toUpperCase(),
          description: description || null,
          discount_type,
          discount_value: discount_type === 'free' ? 0 : parseInt(discount_value),
          max_uses: max_uses ? parseInt(max_uses) : 0,
          expires_at: expires_at || null,
          min_duration: parseInt(min_duration) || 1,
          max_duration: max_duration ? parseInt(max_duration) : null,
        })
        showToast('✅ Voucher updated: ' + code, 'success')
      } else {
        await createVoucher({
          code,
          description,
          discount_type,
          discount_value: discount_type === 'free' ? 0 : parseInt(discount_value),
          max_uses: max_uses ? parseInt(max_uses) : 0,
          expires_at: expires_at || null,
          min_duration: parseInt(min_duration) || 1,
          max_duration: max_duration ? parseInt(max_duration) : null,
        })
        showToast('✅ Voucher created: ' + code, 'success')
      }
      setShowModal(false)
      loadVouchers()
    } catch (error) {
      showToast('❌ ' + error.message, 'error')
    }
  }

  function getDiscountLabel(v) {
    if (v.discount_type === 'free') return 'Gratis (Rp 1)'
    if (v.discount_type === 'percentage') return `${v.discount_value}%`
    if (v.discount_type === 'fixed') return `Rp ${v.discount_value.toLocaleString()}`
    return '-'
  }

  return (
    <div className="card" style={{ border: '2px solid var(--primary)' }}>
      <div className="card-header">
        <span className="card-title">🎫 Voucher Management</span>
        <button onClick={openCreate} className="btn btn-primary btn-sm" style={{ width: 'auto', minHeight: '36px', padding: '4px 16px' }}>
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
                <div style={{ fontWeight: 700, fontSize: '16px', color: 'var(--primary)' }}>{v.code}</div>
                <div style={{ fontSize: '12px', color: 'var(--gray-500)' }}>
                  {v.description || 'Tidak ada deskripsi'} • <strong>{getDiscountLabel(v)}</strong>
                  {' • '}Digunakan: {v.used_count || 0}/{v.max_uses === 0 ? '∞' : v.max_uses}
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
                <button onClick={() => openEdit(v)} className="btn btn-primary btn-sm" style={{ width: 'auto', minHeight: '30px', padding: '4px 12px', fontSize: '12px' }}>✏️ Edit</button>
                {v.active && (
                  <button onClick={async () => {
                    if (confirm('Nonaktifkan voucher ini?')) {
                      await deactivateVoucher(v.id)
                      loadVouchers()
                      showToast('✅ Voucher dinonaktifkan', 'success')
                    }
                  }} className="btn btn-warning btn-sm" style={{ width: 'auto', minHeight: '30px', padding: '4px 12px', fontSize: '12px' }}>Nonaktifkan</button>
                )}
                {!v.active && (
                  <button onClick={async () => {
                    if (confirm('Aktifkan voucher ini?')) {
                      await updateVoucher(v.id, { active: true })
                      loadVouchers()
                      showToast('✅ Voucher diaktifkan', 'success')
                    }
                  }} className="btn btn-success btn-sm" style={{ width: 'auto', minHeight: '30px', padding: '4px 12px', fontSize: '12px' }}>Aktifkan</button>
                )}
                <button onClick={async () => {
                  if (confirm('Hapus voucher ini?')) {
                    await deleteVoucher(v.id)
                    loadVouchers()
                    showToast('✅ Voucher dihapus', 'success')
                  }
                }} className="btn btn-danger btn-sm" style={{ width: 'auto', minHeight: '30px', padding: '4px 12px', fontSize: '12px' }}>Hapus</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: '16px', overflow: 'auto' }}>
          <div style={{ background: 'white', borderRadius: '12px', padding: '24px', maxWidth: '500px', width: '100%', maxHeight: '90vh', overflow: 'auto' }}>
            <h3 style={{ marginBottom: '16px' }}>{editing ? '✏️ Edit Voucher' : '🎫 Create Voucher'}</h3>
            <div className="form-group">
              <label className="form-label">Kode Voucher *</label>
              <input type="text" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="e.g., TEAM2026" className="form-input" style={{ textTransform: 'uppercase' }} disabled={!!editing} />
            </div>
            <div className="form-group">
              <label className="form-label">Deskripsi (opsional)</label>
              <input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="e.g., Team Free Use" className="form-input" />
            </div>
            <div className="form-group">
              <label className="form-label">Tipe Diskon *</label>
              <select value={form.discount_type} onChange={(e) => setForm({ ...form, discount_type: e.target.value, discount_value: e.target.value === 'free' ? '' : form.discount_value })} className="form-input">
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed Amount (Rp)</option>
                <option value="free">Free (Rp 1)</option>
              </select>
            </div>
            {form.discount_type !== 'free' && (
              <div className="form-group">
                <label className="form-label">{form.discount_type === 'percentage' ? 'Nilai Diskon (%) *' : 'Nilai Diskon (Rp) *'}</label>
                <input type="number" value={form.discount_value} onChange={(e) => setForm({ ...form, discount_value: e.target.value })} placeholder={form.discount_type === 'percentage' ? 'e.g., 50' : 'e.g., 20000'} className="form-input" min="1" />
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Batas Penggunaan (0 = unlimited)</label>
              <input type="number" value={form.max_uses} onChange={(e) => setForm({ ...form, max_uses: e.target.value })} placeholder="0" className="form-input" min="0" />
            </div>
            <div className="form-group">
              <label className="form-label">Tanggal Kadaluarsa (opsional)</label>
              <input type="date" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} className="form-input" />
            </div>
            <div className="form-group">
              <label className="form-label">Durasi Minimal (jam)</label>
              <input type="number" value={form.min_duration} onChange={(e) => setForm({ ...form, min_duration: parseInt(e.target.value) || 1 })} className="form-input" min="1" />
            </div>
            <div className="form-group">
              <label className="form-label">Durasi Maksimal (jam) (0 = unlimited)</label>
              <input type="number" value={form.max_duration} onChange={(e) => setForm({ ...form, max_duration: e.target.value })} placeholder="0" className="form-input" min="0" />
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
              <button onClick={() => setShowModal(false)} className="btn btn-outline" style={{ flex: 1 }}>Batal</button>
              <button onClick={handleSave} className="btn btn-primary" style={{ flex: 1 }}>{editing ? 'Update' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
