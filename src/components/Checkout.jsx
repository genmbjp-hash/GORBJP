import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { createPendingBooking, cancelExpiredPendingBookings } from '../lib/supabase'
import { useToast } from '../App'

export default function Checkout({ user }) {
  const navigate = useNavigate()
  const location = useLocation()
  const showToast = useToast()
  const [loading, setLoading] = useState(false)

  const { date, slot, duration } = location.state || {}

  if (!date || !slot || !duration) {
    navigate('/booking')
    return null
  }

  const startTime = new Date(slot.startTime)
  const endTime = new Date(slot.endTime)
  const price = duration * 30000 // Rp 30.000 per hour

  function formatTime(date) {
    return date.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Jakarta'
    })
  }

  function formatDateDisplay(dateStr) {
    const parts = dateStr.split('-')
    const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]))
    return date.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  }

  async function handleConfirmBooking() {
    setLoading(true)

    // Clean up expired pending bookings first
    await cancelExpiredPendingBookings()

    const { data, error } = await createPendingBooking(
      user.id,
      { date: date, hour: slot.hour },
      duration
    )

    if (error) {
      showToast('❌ ' + error.message, 'error')
      setLoading(false)
      return
    }

    // Navigate to payment page with booking ID
    navigate('/payment', {
      state: {
        bookingId: data.id,
        date: date,
        slot: slot,
        duration: duration,
        price: price
      }
    })
  }

  return (
    <div className="container" style={{ paddingTop: '16px' }}>
      <div className="header" style={{ padding: '0 0 16px 0', borderBottom: '2px solid var(--gray-100)' }}>
        <div className="header-content" style={{ padding: 0 }}>
          <div className="logo">
            <span className="logo-icon">🏛️</span>
            <div>
              <span className="logo-text">Gedung Serbaguna BJP</span>
              <span className="logo-sub">Checkout</span>
            </div>
          </div>
          <button onClick={() => navigate('/booking')} className="btn btn-outline btn-sm" style={{ width: 'auto', minHeight: '36px', padding: '4px 16px' }}>
            ← Kembali
          </button>
        </div>
      </div>

      <div className="card" style={{ marginTop: '16px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px' }}>📋 Konfirmasi Pemesanan</h2>

        <div style={{ background: 'var(--primary-bg)', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--gray-200)' }}>
            <span style={{ color: 'var(--gray-600)' }}>📅 Tanggal</span>
            <span style={{ fontWeight: 600 }}>{formatDateDisplay(date)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--gray-200)' }}>
            <span style={{ color: 'var(--gray-600)' }}>⏰ Waktu</span>
            <span style={{ fontWeight: 600 }}>{formatTime(startTime)} - {formatTime(endTime)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--gray-200)' }}>
            <span style={{ color: 'var(--gray-600)' }}>⏱️ Durasi</span>
            <span style={{ fontWeight: 600 }}>{duration} Jam</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
            <span style={{ color: 'var(--gray-600)' }}>💰 Harga</span>
            <span style={{ fontWeight: 700, color: 'var(--success)' }}>
              <span style={{ textDecoration: 'line-through', color: 'var(--gray-400)', marginRight: '8px' }}>
                Rp {price.toLocaleString()}
              </span>
              Rp 0 (Gratis)
            </span>
          </div>
        </div>

        <div style={{ background: '#FEF3C7', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px' }}>
          <p style={{ fontSize: '14px', color: '#92400E' }}>
            ⚠️ Mode Uji Coba — Tidak ada pembayaran yang diproses.
            Slot akan ditahan selama 10 menit.
          </p>
        </div>

        <button onClick={handleConfirmBooking} className="btn btn-primary" disabled={loading}>
          {loading ? '⏳ Memproses...' : '✅ Konfirmasi Booking'}
        </button>

        <button onClick={() => navigate('/booking')} className="btn btn-outline" style={{ marginTop: '8px' }}>
          ← Kembali Pilih Slot
        </button>
      </div>
    </div>
  )
}
