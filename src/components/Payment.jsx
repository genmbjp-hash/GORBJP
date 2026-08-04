import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase, getPendingBooking } from '../lib/supabase'
import { useToast } from '../App'

export default function Payment({ user }) {
  const navigate = useNavigate()
  const location = useLocation()
  const showToast = useToast()
  const [booking, setBooking] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  const { bookingId, date, slot, duration, price } = location.state || {}

  // ✅ Replace with your admin WhatsApp number (without +)
  const ADMIN_PHONE = '6281998889199'
  const WHATSAPP_LINK = `https://wa.me/${ADMIN_PHONE}`

  useEffect(() => {
    const findOrCheckBooking = async () => {
      setIsLoading(true)
      
      if (bookingId) {
        const { data } = await getPendingBooking(bookingId)
        if (data && data.status === 'pending') {
          setBooking(data)
          setIsLoading(false)
          return
        }
      }
      
      const { data: pendingList } = await supabase
        .from('bookings')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)

      if (pendingList && pendingList.length > 0) {
        const pending = pendingList[0]
        setBooking(pending)
        setIsLoading(false)
        return
      }

      navigate('/booking')
    }

    findOrCheckBooking()
  }, [bookingId, user.id, navigate])

  const startTime = booking ? new Date(booking.start_time) : new Date(slot?.startTime)
  const endTime = booking ? new Date(booking.end_time) : new Date(slot?.endTime)
  const dateStr = booking ? booking.start_time.split('T')[0] : date
  const durationHours = booking ? booking.duration_hours : duration
  const priceTotal = booking ? booking.price : price

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

  async function handleCancelBooking() {
    if (!booking) return
    if (!confirm('Apakah Anda yakin ingin membatalkan pesanan ini?')) return

    const { error } = await supabase
      .from('bookings')
      .update({ status: 'cancelled' })
      .eq('id', booking.id)

    if (error) {
      showToast('❌ Gagal membatalkan: ' + error.message, 'error')
      return
    }
    showToast('✅ Pesanan dibatalkan', 'success')
    navigate('/booking')
  }

  function getWhatsAppMessage() {
    if (!booking) return ''
    const message = `Halo Admin, saya sudah melakukan pembayaran untuk booking:

📅 Tanggal: ${formatDateDisplay(dateStr)}
⏰ Waktu: ${formatTime(startTime)} - ${formatTime(endTime)}
⏱️ Durasi: ${durationHours} jam
💰 Total: Rp ${priceTotal.toLocaleString()}
👤 Nama: ${user?.email || 'Customer'}

Mohon dikonfirmasi. Terima kasih.`
    return encodeURIComponent(message)
  }

  if (isLoading) {
    return (
      <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div className="spinner"></div>
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
              <span className="logo-sub">Pembayaran</span>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: '16px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px' }}>💳 Informasi Pembayaran</h2>

        {/* Order Summary */}
        <div style={{ background: 'var(--primary-bg)', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--gray-200)' }}>
            <span style={{ color: 'var(--gray-600)' }}>📅 Tanggal</span>
            <span style={{ fontWeight: 600 }}>{formatDateDisplay(dateStr)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--gray-200)' }}>
            <span style={{ color: 'var(--gray-600)' }}>⏰ Waktu</span>
            <span style={{ fontWeight: 600 }}>{formatTime(startTime)} - {formatTime(endTime)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--gray-200)' }}>
            <span style={{ color: 'var(--gray-600)' }}>⏱️ Durasi</span>
            <span style={{ fontWeight: 600 }}>{durationHours} Jam</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
            <span style={{ color: 'var(--gray-600)' }}>💰 Total</span>
            <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '18px' }}>
              Rp {priceTotal.toLocaleString()}
            </span>
          </div>
        </div>

        {/* QRIS */}
        <div style={{ marginBottom: '16px' }}>
          <h4 style={{ fontWeight: 600, marginBottom: '12px' }}>📱 Bayar dengan QRIS</h4>
          
          <div style={{ padding: '16px', background: '#F0FDF4', borderRadius: '8px', border: '1px solid #86EFAC', textAlign: 'center' }}>
            <p style={{ fontSize: '14px', fontWeight: 600, color: '#065F46', marginBottom: '8px' }}>Scan QRIS di bawah ini</p>
            <img 
              src="/qris.png" 
              alt="QRIS" 
              style={{ 
                maxWidth: '200px', 
                width: '100%', 
                height: 'auto',
                margin: '0 auto',
                display: 'block',
                borderRadius: '8px'
              }} 
            />
            <p style={{ fontSize: '12px', color: '#065F46', marginTop: '8px' }}>
              Total: <strong>Rp {priceTotal.toLocaleString()}</strong>
            </p>
          </div>
        </div>

        {/* WhatsApp Confirmation */}
        <div style={{ background: '#EFF6FF', padding: '16px', borderRadius: '8px', border: '1px solid #93C5FD', marginBottom: '16px' }}>
          <p style={{ fontSize: '14px', color: '#1E40AF', fontWeight: 600, marginBottom: '8px' }}>
            ✅ Setelah membayar, konfirmasi ke admin
          </p>
          <a 
            href={`${WHATSAPP_LINK}?text=${getWhatsAppMessage()}`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-success"
            style={{ 
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              width: '100%',
              textDecoration: 'none'
            }}
          >
            💬 Konfirmasi via WhatsApp
          </a>
          <p style={{ fontSize: '12px', color: '#1E40AF', marginTop: '8px', textAlign: 'center' }}>
            Booking akan aktif setelah admin mengkonfirmasi pembayaran.
          </p>
        </div>

        <button 
          onClick={handleCancelBooking} 
          className="btn btn-danger"
          disabled={!booking}
          style={{ marginTop: '8px' }}
        >
          ❌ Batalkan Pesanan
        </button>

        <button 
          onClick={() => navigate('/dashboard')} 
          className="btn btn-outline"
          style={{ marginTop: '8px' }}
        >
          📋 Lihat Pesanan Saya
        </button>
      </div>
    </div>
  )
}
