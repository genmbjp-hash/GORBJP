// src/components/admin/AdminUsers.jsx

import React, { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { approveUser } from '../../lib/api'
import { useToast } from '../../hooks/useToast'

export default function AdminUsers() {
  const [pendingUsers, setPendingUsers] = useState([])
  const { showToast } = useToast()

  useEffect(() => {
    loadPendingUsers()
  }, [])

  async function loadPendingUsers() {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
    setPendingUsers(data || [])
  }

  async function handleApprove(userId) {
    if (!confirm('Setujui user ini?')) return
    try {
      await approveUser(userId, 'approve')
      showToast('✅ User disetujui', 'success')
      loadPendingUsers()
    } catch (error) {
      showToast('❌ ' + error.message, 'error')
    }
  }

  async function handleReject(userId) {
    if (!confirm('Tolak user ini?')) return
    try {
      await approveUser(userId, 'reject')
      showToast('✅ User ditolak', 'success')
      loadPendingUsers()
    } catch (error) {
      showToast('❌ ' + error.message, 'error')
    }
  }

  function formatDate(dateStr) {
    const d = new Date(dateStr)
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  return (
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
  )
}
