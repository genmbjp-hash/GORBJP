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

  function getPriceDisplay(booking) {
    if (booking.is_admin_booking) {
      return '🔒 Tutup Admin'
    }
    if (booking.payment_status === 'free') {
      return '🆓 GRATIS'
    }
    if (booking.price === 0 || booking.price === null) {
      return '🆓 GRATIS'
    }
    return `Rp ${booking.price?.toLocaleString() || 0}`
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

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">📋 Semua Pesanan</span>
      </div>

      {bookings.length === 0 ? (
        <p style={{ color: 'var(--gray-400)', textAlign: 'center', padding: '20px' }}>Belum ada pesanan</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Pending Bookings */}
          {pendingBookings.length > 0 && (
            <>
              <h4 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--warning)', marginTop: '8px' }}>
                ⏳ Menunggu Konfirmasi Pembayaran
              </h4>
              {pendingBookings.map(b => (
                <div key={b.id} className="booking-item" style={{ background: '#FEF3C7', borderRadius: '8px', padding: '12px 16px' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '14px' }}>
                      {b.profiles?.display_name || b.profiles?.full_name || 'Unknown'}
                      <span style={{ fontWeight: 400, color: 'var(--gray-500)', fontSize: '12px' }}> {b.profiles?.email || ''}</span>
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--gray-600)' }}>
                      {formatDate(b.start_time)} {formatTime(b.start_time)} - {formatTime(b.end_time)}
                    </div>
                    <div style={{ marginTop: '4px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px' }}>
                      {getStatusBadge(b.status)}
                      {getPaymentBadge(b.payment_status || 'pending')}
                      {b.closure_reason && (
                        <span className="badge" style={{ background: '#FEE2E2', color: '#991B1B' }}>
                          📝 {b.closure_reason}
                        </span>
                      )}
                      <span style={{ fontWeight: 600, color: b.is_admin_booking ? 'var(--gray-500)' : 'var(--primary)' }}>
                        {getPriceDisplay(b)}
                      </span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button onClick={() => handleConfirmPayment(b.id)} className="btn btn-success btn-sm" style={{ width: 'auto', minHeight: '32px', padding: '4px 12px', fontSize: '12px' }}>
                      ✅ Confirm Payment
                    </button>
                    <button onClick={() => handleCancelBooking(b.id)} className="btn btn-danger btn-sm" style={{ width: 'auto', minHeight: '32px', padding: '4px 12px', fontSize: '12px' }}>
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
                <div style={{ marginTop: '4px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px' }}>
                  {getStatusBadge(b.status)}
                  {getPaymentBadge(b.payment_status || 'free')}
                  {b.voucher_id && <span className="badge" style={{ background: '#E0E7FF', color: '#3730A3' }}>🎫 Voucher</span>}
                  {b.closure_reason && (
                    <span className="badge" style={{ background: '#FEE2E2', color: '#991B1B' }}>
                      📝 {b.closure_reason}
                    </span>
                  )}
                  <span style={{ fontWeight: 600, color: b.is_admin_booking ? 'var(--gray-500)' : 'var(--primary)' }}>
                    {getPriceDisplay(b)}
                  </span>
                </div>
              </div>
              <div>
                {b.pin && (
                  <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--primary)', letterSpacing: '2px' }}>
                    {b.pin}
                  </div>
                )}
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
  )
}
