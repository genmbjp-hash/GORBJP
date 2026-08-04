import React, { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { confirmPayment, cancelPendingBooking, getPendingBooking } from '../lib/supabase'
import { useToast } from '../App'

export default function Payment({ user }) {
  const navigate = useNavigate()
  const location = useLocation()
  const showToast = useToast()
  const [loading, setLoading] = useState(false)
  const [timeLeft, setTimeLeft] = useState(600)
  const [booking, setBooking] = useState(null)

  const { bookingId, date, slot, duration, price } = location.state || {}

  // If no bookingId, try to find pending booking from database
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const findOrCheckBooking = async () => {
      setIsLoading(true)
      
      // If bookingId is provided, use it
      if (bookingId) {
        const { data } = await getPendingBooking(bookingId)
        if (data && data.status === 'pending') {
          setBooking(data)
          const deadline = new Date(data.payment_deadline)
          const remaining = Math.max(0, Math.floor((deadline - new Date()) / 1000))
          setTimeLeft(remaining)
          setIsLoading(false)
          return
        }
      }
      
      // If no bookingId, or booking is not pending, find any pending booking for this user
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
        const deadline = new Date(pending.payment_deadline)
        const remaining = Math.max(0, Math.floor((deadline - new Date()) / 1000))
        setTimeLeft(remaining)
        
        // Update location state with the found booking
        // so it can be used by the rest of the component
        // (We'll handle this below)
        setIsLoading(false)
        return
      }

      // No pending booking found
      navigate('/booking')
    }

    findOrCheckBooking()
  }, [bookingId, user.id, navigate])

  // Timer countdown
  useEffect(() => {
    if (timeLeft <= 0) {
      const handleTimeout = async () => {
        if (booking?.id) {
          await cancelPendingBooking(booking.id)
        }
        showToast('⏰ Waktu pembayaran habis', 'warning')
        navigate('/payment-failed', {
          state: { 
            bookingId: booking?.id, 
            reason: 'Waktu pembayaran habis. Silakan coba lagi.',
            retry: true
          }
        })
      }
      if (booking) {
        handleTimeout()
      }
      return
    }

    const timer = setInterval(() => {
      setTimeLeft(prev => prev - 1)
    }, 1000)

    return () => clearInterval(timer)
  }, [timeLeft, booking, navigate, showToast])

  // Use booking data if available, otherwise use location state
  const startTime = booking ? new Date(booking.start_time) : new Date(slot?.startTime)
  const endTime = booking ? new Date(booking.end_time) : new Date(slot?.endTime)
  const dateStr = booking ? booking.start_time.split('T')[0] : date
  const durationHours = booking ? booking.duration_hours : duration
  const priceTotal = booking ? booking.duration_hours * 30000 : price

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

  function formatTimeLeft(seconds) {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  async function handlePayment() {
    if (!booking) {
      showToast('❌ Booking tidak ditemukan', 'error')
      return
    }

    setLoading(true)

    await new Promise(resolve => setTimeout(resolve, 2000 + Math.random() * 1000))

    const isSuccess = Math.random() < 0.8

    if (isSuccess) {
      const { data, error } = await confirmPayment(booking.id)

      if (error) {
        showToast('❌ Gagal memproses pembayaran: ' + error.message, 'error')
        setLoading(false)
        return
      }

      navigate('/payment-success', {
        state: { booking: data }
      })
    } else {
      const reasons = [
        'Saldo Anda tidak mencukupi untuk transaksi ini',
        'Koneksi internet terputus, silakan coba lagi',
        'Transaksi ditolak oleh bank penerbit',
        'Melebihi batas transaksi harian'
      ]
      const randomReason = reasons[Math.floor(Math.random() * reasons.length)]

      await cancelPendingBooking(booking.id)

      navigate('/payment-failed', {
        state: {
          bookingId: booking.id,
          reason: randomReason,
          retry: true
        }
      })
    }

    setLoading(false)
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
        <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px' }}>💳 Pembayaran</h2>

        <div style={{ textAlign: 'center', marginBottom: '16px', padding: '12px', background: timeLeft < 60 ? '#FEE2E2' : '#FEF3C7', borderRadius: '8px' }}>
          <span style={{ fontSize: '14px', color: timeLeft < 60 ? '#991B1B' : '#92400E' }}>
            ⏰ Waktu tersisa: <strong>{formatTimeLeft(timeLeft)}</strong>
          </span>
        </div>

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
            <span style={{ fontWeight: 700, color: 'var(--success)' }}>
              <span style={{ textDecoration: 'line-through', color: 'var(--gray-400)', marginRight: '8px' }}>
                Rp {priceTotal.toLocaleString()}
              </span>
              Rp 0 (Gratis)
            </span>
          </div>
        </div>

        <div style={{ marginBottom: '16px' }}>
          <p style={{ fontWeight: 600, marginBottom: '8px' }}>💳 Metode Pembayaran</p>
          <div style={{ padding: '12px 16px', background: '#F3F4F6', borderRadius: '8px' }}>
            <span style={{ fontSize: '14px', color: 'var(--gray-500)' }}>
              ✅ Gratis (Mode Uji Coba)
            </span>
          </div>
        </div>

        <div style={{ background: '#FEF3C7', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px' }}>
          <p style={{ fontSize: '14px', color: '#92400E' }}>
            ⚠️ Mode Uji Coba — Tidak ada uang yang benar-benar ditransfer.
            {timeLeft < 60 && <span style={{ display: 'block', marginTop: '4px', fontWeight: 'bold' }}>⏰ Segera selesaikan pembayaran!</span>}
          </p>
        </div>

        <button onClick={handlePayment} className="btn btn-primary" disabled={loading || timeLeft <= 0 || !booking}>
          {loading ? '⏳ Memproses...' : timeLeft <= 0 ? '⏰ Waktu Habis' : '💳 Bayar Sekarang'}
        </button>
      </div>
    </div>
  )
}
