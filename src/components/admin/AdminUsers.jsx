// src/components/admin/AdminUsers.jsx

import React, { useState, useEffect, useCallback, useMemo, memo } from 'react'
import { supabase } from '../../lib/supabase'
import { approveUser } from '../../lib/api'
import { useToast } from '../../contexts/ToastContext'

// ============================================
// USER ITEM COMPONENT (memoized)
// ============================================

const UserItem = memo(function UserItem({ user, onApprove, onReject, formatDate }) {
  return (
    <div className="user-item">
      <div className="user-info">
        <div className="user-name">
          {user.display_name || user.full_name || 'Unknown'}
          <span style={{ fontSize: '11px', color: 'var(--gray-400)', marginLeft: '8px' }}>
            (Nama lengkap: {user.full_name})
          </span>
        </div>
        <div className="user-email">{user.email}</div>
        <div style={{ fontSize: '12px', color: 'var(--gray-500)' }}>
          📞 {user.phone || '-'} • Blok {user.block || '-'} No. {user.house_number || '-'}
        </div>
        <div style={{ fontSize: '12px', color: 'var(--gray-400)', marginTop: '4px' }}>
          Daftar: {formatDate(user.created_at)}
        </div>
      </div>
      <div className="user-actions">
        <button 
          onClick={() => onApprove(user.id)} 
          className="btn btn-success btn-sm" 
          style={{ width: 'auto', minHeight: '36px', padding: '4px 16px' }}
        >
          ✅ Setujui
        </button>
        <button 
          onClick={() => onReject(user.id)} 
          className="btn btn-danger btn-sm" 
          style={{ width: 'auto', minHeight: '36px', padding: '4px 16px' }}
        >
          ❌ Tolak
        </button>
      </div>
    </div>
  )
})

// ============================================
// MAIN COMPONENT
// ============================================

export default function AdminUsers() {
  const [pendingUsers, setPendingUsers] = useState([])
  const [filteredUsers, setFilteredUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(10)
  const { showToast } = useToast()

  // ✅ Format date (moved outside render)
  const formatDate = useCallback((dateStr) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
  }, [])

  // ✅ Load pending users with error handling
  const loadPendingUsers = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true })

      if (error) {
        showToast('❌ Gagal memuat user: ' + error.message, 'error')
        setPendingUsers([])
        setFilteredUsers([])
      } else {
        setPendingUsers(data || [])
        setFilteredUsers(data || [])
      }
    } catch (error) {
      showToast('❌ Gagal memuat user', 'error')
      setPendingUsers([])
      setFilteredUsers([])
    } finally {
      setLoading(false)
    }
  }, [showToast])

  // ✅ Initial load
  useEffect(() => {
    loadPendingUsers()
  }, [loadPendingUsers])

  // ✅ Search/filter with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!searchTerm.trim()) {
        setFilteredUsers(pendingUsers)
        setCurrentPage(1)
        return
      }

      const term = searchTerm.toLowerCase().trim()
      const filtered = pendingUsers.filter(user => 
        user.display_name?.toLowerCase().includes(term) ||
        user.full_name?.toLowerCase().includes(term) ||
        user.email?.toLowerCase().includes(term) ||
        user.phone?.includes(term) ||
        user.block?.toLowerCase().includes(term) ||
        user.house_number?.toLowerCase().includes(term)
      )
      setFilteredUsers(filtered)
      setCurrentPage(1)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchTerm, pendingUsers])

  // ✅ Handle approve
  const handleApprove = useCallback(async (userId) => {
    if (!confirm('Setujui user ini?')) return
    try {
      await approveUser(userId, 'approve')
      showToast('✅ User disetujui', 'success')
      loadPendingUsers()
    } catch (error) {
      showToast('❌ ' + error.message, 'error')
    }
  }, [showToast, loadPendingUsers])

  // ✅ Handle reject
  const handleReject = useCallback(async (userId) => {
    if (!confirm('Tolak user ini?')) return
    try {
      await approveUser(userId, 'reject')
      showToast('✅ User ditolak', 'success')
      loadPendingUsers()
    } catch (error) {
      showToast('❌ ' + error.message, 'error')
    }
  }, [showToast, loadPendingUsers])

  // ✅ Pagination logic
  const paginatedUsers = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return filteredUsers.slice(startIndex, endIndex)
  }, [filteredUsers, currentPage, itemsPerPage])

  const totalPages = useMemo(() => {
    return Math.ceil(filteredUsers.length / itemsPerPage)
  }, [filteredUsers.length, itemsPerPage])

  // ✅ Handle page change
  const handlePageChange = useCallback((page) => {
    setCurrentPage(page)
    // Scroll to top of list
    const listElement = document.querySelector('.user-list')
    if (listElement) {
      listElement.scrollTop = 0
    }
  }, [])

  // ✅ Memoized search handler
  const handleSearchChange = useCallback((e) => {
    setSearchTerm(e.target.value)
  }, [])

  // ✅ Refresh handler
  const handleRefresh = useCallback(() => {
    if (!loading) {
      loadPendingUsers()
    }
  }, [loadPendingUsers, loading])

  // ✅ Memoized stats
  const stats = useMemo(() => ({
    total: pendingUsers.length,
    filtered: filteredUsers.length,
    pending: filteredUsers.length,
  }), [pendingUsers.length, filteredUsers.length])

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">👤 Persetujuan User</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span className="badge badge-pending">{stats.pending}</span>
          <button 
            onClick={handleRefresh} 
            className="btn btn-outline btn-sm" 
            style={{ width: 'auto', minHeight: '32px', padding: '4px 12px', fontSize: '12px' }}
            disabled={loading}
          >
            {loading ? '⏳' : '🔄'}
          </button>
        </div>
      </div>

      {/* ✅ Search bar */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--gray-100)' }}>
        <input
          type="text"
          placeholder="🔍 Cari user (nama, email, blok, no. rumah)..."
          value={searchTerm}
          onChange={handleSearchChange}
          style={{
            width: '100%',
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
        {searchTerm && (
          <div style={{ marginTop: '4px', fontSize: '12px', color: 'var(--gray-500)' }}>
            Menampilkan {stats.filtered} dari {stats.total} user
          </div>
        )}
      </div>

      {/* ✅ User list */}
      <div className="user-list" style={{ maxHeight: '400px', overflowY: 'auto' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <div className="spinner" style={{ margin: '0 auto' }}></div>
            <p style={{ marginTop: '12px', color: 'var(--gray-500)', fontSize: '14px' }}>Memuat user...</p>
          </div>
        ) : paginatedUsers.length === 0 ? (
          <p style={{ color: 'var(--gray-400)', textAlign: 'center', padding: '20px' }}>
            {searchTerm ? '🔍 Tidak ada user yang cocok' : '✅ Tidak ada user menunggu'}
          </p>
        ) : (
          paginatedUsers.map(u => (
            <UserItem
              key={u.id}
              user={u}
              onApprove={handleApprove}
              onReject={handleReject}
              formatDate={formatDate}
            />
          ))
        )}
      </div>

      {/* ✅ Pagination */}
      {totalPages > 1 && (
        <div style={{ 
          padding: '12px 16px', 
          borderTop: '1px solid var(--gray-100)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '8px'
        }}>
          <div style={{ fontSize: '13px', color: 'var(--gray-500)' }}>
            Halaman {currentPage} dari {totalPages}
          </div>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="btn btn-outline btn-sm"
              style={{ 
                width: 'auto', 
                minHeight: '32px', 
                padding: '4px 12px', 
                fontSize: '12px',
                opacity: currentPage === 1 ? 0.5 : 1
              }}
            >
              ← Prev
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum
              if (totalPages <= 5) {
                pageNum = i + 1
              } else if (currentPage <= 3) {
                pageNum = i + 1
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i
              } else {
                pageNum = currentPage - 2 + i
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => handlePageChange(pageNum)}
                  className={`btn btn-sm ${currentPage === pageNum ? 'btn-primary' : 'btn-outline'}`}
                  style={{ 
                    width: 'auto', 
                    minHeight: '32px', 
                    padding: '4px 12px', 
                    fontSize: '12px',
                    minWidth: '36px'
                  }}
                >
                  {pageNum}
                </button>
              )
            })}
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="btn btn-outline btn-sm"
              style={{ 
                width: 'auto', 
                minHeight: '32px', 
                padding: '4px 12px', 
                fontSize: '12px',
                opacity: currentPage === totalPages ? 0.5 : 1
              }}
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
