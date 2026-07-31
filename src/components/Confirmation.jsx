import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useToast } from '../App'

export default function Confirmation() {
  const navigate = useNavigate()
  const location = useLocation()
  const showToast = useToast()

  const { booking } = location.state || {}

  if (!booking) {
    navigate('/dashboard')
    return null
  }

  function formatTime(dateStr) {
    const d = new Date(dateStr)
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  }

  function formatDate(dateStr) {
    const d = new Date(dateStr)
    return d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  }

  function copyPin(pin) {
    navigator.clipboard.writeText(pin).then(() => {
      showToast('✅ PIN disalin!', 'success')
    }).catch(() => {
      const text = `PIN: ${pin}`
      const textarea = document.createElement('textarea')
      textarea.value = text
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      textarea.remove()
      showToast('✅ PIN disalin!', 'success')
    })
  }

  return (
    <div className="container" style={{ paddingTop: '40px' }}>
      <div className="card" style={{ border: '2px solid var(--success)' }}>
        <div className="text-center">
          <h2 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--success)' }}>✅ Pemesanan Berhasil!</h2>
          <p style={{ color: 'var(--gray-500)' }}>PIN Anda untuk masuk ke venue:</p>

          <div className="pin-display">
            <div className="pin-label">PIN ANDA</div>
            <div className="pin-number">{booking.pin}</div>
          </div>

          <button 
            onClick={() => copyPin(booking.pin)} 
            className="btn btn-secondary btn-sm" 
            style={{ width: 'auto', minHeight: '40px', padding: '8px 24px' }}
          >
            📋 Salin PIN
          </button>

          <div style={{ marginTop: '16px', fontSize: '14px', color: 'var(--gray-500)' }}>
            <strong>{formatDate(booking.start_time)}</strong><br />
            {formatTime(booking.start_time)} - {formatTime(booking.end_time)}
          </div>

          <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--gray-400)' }}>
            Status: <span className="badge badge-completed">Gratis</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
            <button onClick={() => navigate('/dashboard')} className="btn btn-primary">
              📋 Lihat Pesanan Saya
            </button>
            <button onClick={() => navigate('/booking')} className="btn btn-secondary">
              📖 Pesan Lagi
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
