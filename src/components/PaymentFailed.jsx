import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { cancelPendingBooking } from '../lib/supabase'
import { useToast } from '../App'

export default function PaymentFailed() {
  const navigate = useNavigate()
  const location = useLocation()
  const showToast = useToast()

  const { bookingId, reason, retry } = location.state || {}

  async function handleRetry() {
    // Cancel the failed booking if it's still pending
    if (bookingId) {
      await cancelPendingBooking(bookingId)
    }
    navigate('/booking')
  }

  async function handleCancel() {
    if (bookingId) {
      await cancelPendingBooking(bookingId)
    }
    navigate('/booking')
  }

  return (
    <div className="container" style={{ paddingTop: '40px' }}>
      <div className="card" style={{ border: '2px solid var(--danger)' }}>
        <div className="text-center">
          <h2 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--danger)' }}>
            ❌ Pembayaran Gagal
          </h2>

          <div style={{ marginTop: '16px', padding: '16px', background: '#FEE2E2', borderRadius: '8px' }}>
            <p style={{ color: '#991B1B', fontSize: '14px' }}>
              {reason || 'Maaf, pembayaran Anda gagal diproses.'}
            </p>
          </div>

          <div style={{ marginTop: '16px', padding: '16px', background: '#FEF3C7', borderRadius: '8px' }}>
            <p style={{ fontSize: '14px', color: '#92400E' }}>
              💡 Tips:
              <br />
              • Pastikan saldo Anda mencukupi
              <br />
              • Coba gunakan metode pembayaran lain
              <br />
              • Periksa koneksi internet Anda
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
            {retry && (
              <button onClick={handleRetry} className="btn btn-primary">
                🔄 Coba Lagi
              </button>
            )}
            <button onClick={handleCancel} className="btn btn-secondary">
              📅 Kembali ke Booking
            </button>
            <button onClick={() => navigate('/dashboard')} className="btn btn-outline">
              📋 Lihat Pesanan Saya
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
