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
  const pendingBooking = bookings.find(b => b.status === 'pending')

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
          <button onClick={handleLogout} className="btn btn-outline btn-sm" style={{ width: 'auto',
