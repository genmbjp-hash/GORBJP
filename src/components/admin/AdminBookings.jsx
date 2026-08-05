// src/components/admin/AdminBookings.jsx

import React from 'react'
import { confirmPayment } from '../../lib/api'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../hooks/useToast'

export default function AdminBookings({ bookings, onRefresh }) {
  const { showToast } = useToast()

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
    }
    const labels = {
      'pending': '⏳ Menunggu',
      'active': '✅ Aktif',
      'completed': '✔️ Selesai',
      'cancelled': '❌ Dibatalkan',
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
      'refunded': { bg: '#E0E7FF', color: '#3730A3', label: '↩️ Dikembalikan' },
    }
    const style = styles[paymentStatus] || styles['pending']
    return <span className="badge" style={{ marginLeft: '4px', background: style.bg, color: style.color }}>{style.label}</span>
  }

  async function handleConfirmPayment(bookingId) {
    if (!confirm('Konfirmasi pembayaran untuk booking ini?')) return

    try {
      const result = await confirmPayment(bookingId)
      showToast(`✅ Pembayaran dikonfirmasi! PIN: ${result.pin}`, 'success')
      onRefresh()
    } catch (error) {
      showToast('❌ ' + error.message, 'error')
    }
  }

  async function handleCancelBooking(bookingId) {
    if (!confirm('Batalkan booking ini?')) return
    const { error } = await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', bookingId)
    if (error) {
      showToast('❌ Gagal membatalkan: ' + error.message, 'error')
    } else {
      showToast('✅ Booking dibatalkan', 'success')
      onRefresh()
    }
  }

  const pendingBookings = bookings.filter(b => b.status === 'pending' && b.payment_status === 'pending')
 
