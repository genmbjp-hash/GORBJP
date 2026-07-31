import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { checkAvailability, createBooking } from '../lib/supabase'
import { useToast } from '../App'

export default function Booking({ user }) {
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [duration, setDuration] = useState(2)
  const [loading, setLoading] = useState(false)
  const [available, setAvailable] = useState(null)
  const [confirmed, setConfirmed] = useState(null)
  const navigate = useNavigate()
  const showToast = useToast()

  const today = new Date().toISOString().split('T')[0]

  async function handleCheckAvailability() {
    if (!date || !startTime) {
      showToast('❌ Silakan pilih tanggal dan jam', 'error')
      return
    }

    setLoading(true)
    const { available, data, error } = await checkAvailability(date, startTime, duration)

    if (error) {
      showToast('❌ ' + error.message, 'error')
      setLoading(false)
      return
    }

    setAvailable(available)
    setLoading(false)

    if (available) {
      showToast('✅ Slot tersedia!', 'success')
    } else {
      showToast('⚠️ Slot tidak tersedia. Pilih waktu lain.', 'warning')
    }
  }

  async function handleBook() {
    if (!date || !startTime) {
      showToast('❌ Silakan pilih tanggal dan jam', 'error')
      return
    }

    setLoading(true)
    const { data, error } = await createBooking(user.id, date, startTime, duration)

    if (error) {
      showToast('❌ ' + error.message, 'error')
      setLoading(false)
      return
    }

    setConfirmed(data)
    showToast('✅ Pemesanan berhasil! PIN: ' + data.pin, 'success')
    setLoading(false)
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

  if (confirmed) {
    return (
      <div className="container" style={{ paddingTop: '40px' }}>
        <div className="card" style={{ border: '2px solid var(--success)' }}>
          <div className="text-center">
            <h2 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--success)' }}>✅ Pemesanan Berhasil!</h2>
            <p style={{ color: 'var(--gray-500)' }}>PIN Anda untuk masuk ke venue:</p>
            <div className="pin-display">
              <div className="pin-label">PIN ANDA</div>
              <div className="pin-number">{confirmed.pin}</div>
            </div>
            <button onClick={() => copyPin(confirmed.pin)} className="btn btn-secondary btn-sm" style={{ width: 'auto', minHeight: '40px', padding: '8px 24px' }}>
              📋 Salin PIN
            </button>
            <div style={{ marginTop: '16px', fontSize: '14px', color: 'var(--gray-500)' }}>
              <strong>{new Date(confirmed.start_time).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</strong><br />
              {new Date(confirmed.start_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} - {new Date(confirmed.end_time).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
            </div>
            <button onClick={() => navigate('/dashboard')} className="btn btn-primary" style={{ marginTop: '16px' }}>
              📋 Lihat Pesanan Saya
            </button>
          </div>
        </div>
      </div>
    )
  }

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
          <button onClick={() => navigate('/dashboard')} className="btn btn-outline btn-sm" style={{ width: 'auto', minHeight: '36px', padding: '4px 16px' }}>
            ← Kembali
          </button>
        </div>
      </div>

      <div className="card" style={{ marginTop: '16px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 700 }}>📅 Pesan Slot</h2>
        <p style={{ color: 'var(--gray-500)', fontSize: '14px' }}>Pilih tanggal dan waktu yang diinginkan</p>

        <div className="form-group" style={{ marginTop: '16px' }}>
          <label className="form-label" htmlFor="bookingDate">Tanggal</label>
          <input
            type="date"
            id="bookingDate"
            className="form-input"
            min={today}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="startTime">Jam Mulai</label>
          <select
            id="startTime"
            className="form-input"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            required
          >
            <option value="">Pilih jam</option>
            {['08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00'].map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="duration">Durasi</label>
          <select
            id="duration"
            className="form-input"
            value={duration}
            onChange={(e) => setDuration(parseInt(e.target.value))}
          >
            <option value="2">2 Jam</option>
            <option value="3">3 Jam</option>
            <option value="4">4 Jam</option>
          </select>
        </div>

        <button
          onClick={handleCheckAvailability}
          className="btn btn-secondary"
          disabled={loading}
        >
          {loading ? '⏳ Memeriksa...' : '🔍 Cek Ketersediaan'}
        </button>

        {available === true && (
          <div style={{ marginTop: '16px' }}>
            <div className="alert alert-success">✅ Tersedia! Silakan lanjutkan pemesanan.</div>
            <div style={{ background: 'var(--primary-bg)', padding: '16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--primary)' }}>
              <h4 style={{ fontWeight: 600, color: 'var(--primary)' }}>💳 Ringkasan Pemesanan</h4>
              <div style={{ fontSize: '14px', marginTop: '8px' }}>
                <div><strong>Tanggal:</strong> {new Date(`${date}T${startTime}`).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
                <div><strong>Waktu:</strong> {startTime} - {new Date(new Date(`${date}T${startTime}`).getTime() + duration * 60 * 60 * 1000).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</div>
                <div><strong>Durasi:</strong> {duration} jam</div>
              </div>
              <button onClick={handleBook} className="btn btn-primary" style={{ marginTop: '12px' }} disabled={loading}>
                {loading ? '⏳ Memproses...' : '📖 Pesan Sekarang'}
              </button>
            </div>
          </div>
        )}

        {available === false && (
          <div className="alert alert-warning" style={{ marginTop: '16px' }}>
            ⚠️ Slot tidak tersedia. Silakan pilih waktu lain.
          </div>
        )}
      </div>
    </div>
  )
}
