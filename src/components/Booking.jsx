import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, createBooking } from '../lib/supabase'
import { useToast } from '../App'

export default function Booking({ user }) {
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [duration, setDuration] = useState(1)
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [bookingSlots, setBookingSlots] = useState([])
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [confirmed, setConfirmed] = useState(null)
  const navigate = useNavigate()
  const showToast = useToast()

  // Operating hours
  const OPEN_HOUR = 7
  const CLOSE_HOUR = 23 // Last slot starts at 23:00 (ends at 24:00)

  useEffect(() => {
    loadBookings()
  }, [selectedDate])

  async function loadBookings() {
    setLoading(true)
    
    const startDate = new Date(selectedDate)
    startDate.setHours(0, 0, 0, 0)
    
    const endDate = new Date(selectedDate)
    endDate.setHours(23, 59, 59, 999)

    const { data, error } = await supabase
      .from('bookings')
      .select(`
        *,
        profiles(full_name)
      `)
      .gte('start_time', startDate.toISOString())
      .lte('start_time', endDate.toISOString())
      .or(`status.eq.pending,status.eq.active,status.eq.completed`)

    if (error) {
      showToast('❌ Gagal memuat booking: ' + error.message, 'error')
      setLoading(false)
      return
    }

    setBookings(data || [])
    generateSlots(data || [])
    setLoading(false)
  }

  function generateSlots(existingBookings) {
    const slots = []
    const dateStr = selectedDate.toISOString().split('T')[0]

    for (let hour = OPEN_HOUR; hour <= CLOSE_HOUR; hour++) {
      const startTime = new Date(selectedDate)
      startTime.setHours(hour, 0, 0, 0)
      
      const endTime1 = new Date(startTime)
      endTime1.setHours(hour + 1, 0, 0)
      
      const endTime2 = new Date(startTime)
      endTime2.setHours(hour + 2, 0, 0)

      // Check if slot is available for 1 hour
      const isAvailable1 = !existingBookings.some(b => {
        const bStart = new Date(b.start_time)
        const bEnd = new Date(b.end_time)
        return startTime < bEnd && endTime1 > bStart
      })

      // Check if slot is available for 2 hours
      const isAvailable2 = !existingBookings.some(b => {
        const bStart = new Date(b.start_time)
        const bEnd = new Date(b.end_time)
        return startTime < bEnd && endTime2 > bStart
      })

      // Find who booked this slot (for display)
      const booking = existingBookings.find(b => {
        const bStart = new Date(b.start_time)
        const bEnd = new Date(b.end_time)
        return startTime >= bStart && startTime < bEnd
      })

      slots.push({
        hour,
        startTime,
        endTime1,
        endTime2,
        isAvailable1,
        isAvailable2,
        isBooked: !isAvailable1 && !isAvailable2,
        bookedBy: booking?.profiles?.full_name || null,
        bookingId: booking?.id || null
      })
    }

    setBookingSlots(slots)
  }

  function formatTime(date) {
    return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  }

  function formatDate(date) {
    return date.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  }

  function changeDate(days) {
    const newDate = new Date(selectedDate)
    newDate.setDate(newDate.getDate() + days)
    setSelectedDate(newDate)
    setSelectedSlot(null)
  }

  async function handleBook(slot) {
    if (!user) {
      showToast('❌ Silakan login terlebih dahulu', 'error')
      return
    }

    setLoading(true)

    const startTime = slot.startTime
    const endTime = duration === 1 ? slot.endTime1 : slot.endTime2

    // Check again for overlap (to be safe)
    const { data: existingBookings, error: checkError } = await supabase
      .from('bookings')
      .select('*')
      .or(`status.eq.pending,status.eq.active`)
      .filter('start_time', 'lt', endTime.toISOString())
      .filter('end_time', 'gt', startTime.toISOString())

    if (checkError) {
      showToast('❌ ' + checkError.message, 'error')
      setLoading(false)
      return
    }

    if (existingBookings.length > 0) {
      showToast('❌ Slot sudah dibooking oleh orang lain', 'error')
      setLoading(false)
      return
    }

    // Generate PIN
    const { data: pinData, error: pinError } = await supabase.rpc('generate_pin')
    if (pinError) {
      showToast('❌ Gagal generate PIN: ' + pinError.message, 'error')
      setLoading(false)
      return
    }

    // Create booking
    const { data, error } = await supabase
      .from('bookings')
      .insert({
        user_id: user.id,
        pin: pinData,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        duration_hours: duration,
        status: 'pending'
      })
      .select()
      .single()

    if (error) {
      showToast('❌ Gagal booking: ' + error.message, 'error')
      setLoading(false)
      return
    }

    setConfirmed(data)
    showToast('✅ Pemesanan berhasil! PIN: ' + data.pin, 'success')
    setLoading(false)
    loadBookings()
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

  // Check if a slot can be booked
  function canBookSlot(slot) {
    if (duration === 1) return slot.isAvailable1
    if (duration === 2) return slot.isAvailable2
    return false
  }

  // Check if current time is before slot start (min 1 hour ahead)
  function isSlotBookable(slot) {
    const now = new Date()
    const minStartTime = new Date(now.getTime() + 60 * 60 * 1000) // 1 hour from now
    return slot.startTime >= minStartTime
  }

  // Confirmation view
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
              <strong>{formatDate(new Date(confirmed.start_time))}</strong><br />
              {formatTime(new Date(confirmed.start_time))} - {formatTime(new Date(confirmed.end_time))}
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
      {/* Header */}
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

      {/* Date Selector */}
      <div className="card" style={{ marginTop: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={() => changeDate(-1)} className="btn btn-outline btn-sm" style={{ width: 'auto', minHeight: '40px', padding: '8px 16px' }}>
            ← Sebelumnya
          </button>
          <span style={{ fontWeight: 600, fontSize: '16px' }}>{formatDate(selectedDate)}</span>
          <button onClick={() => changeDate(1)} className="btn btn-outline btn-sm" style={{ width: 'auto', minHeight: '40px', padding: '8px 16px' }}>
            Selanjutnya →
          </button>
        </div>
      </div>

      {/* Duration Selection */}
      <div className="card">
        <p style={{ fontWeight: 600, marginBottom: '12px' }}>Pilih durasi:</p>
        <div style={{ display: 'flex', gap: '16px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input 
              type="radio" 
              name="duration" 
              value="1" 
              checked={duration === 1} 
              onChange={() => setDuration(1)} 
            />
            1 Jam
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input 
              type="radio" 
              name="duration" 
              value="2" 
              checked={duration === 2} 
              onChange={() => setDuration(2)} 
            />
            2 Jam
          </label>
        </div>
      </div>

      {/* Slots */}
      <div className="card">
        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>
          📋 Daftar Slot
          {loading && <span style={{ fontSize: '12px', color: 'var(--gray-400)', marginLeft: '8px' }}>⏳ Memuat...</span>}
        </h3>

        {bookingSlots.length === 0 && !loading ? (
          <p style={{ color: 'var(--gray-400)', textAlign: 'center', padding: '20px' }}>Tidak ada slot untuk hari ini</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {bookingSlots.map((slot) => {
              const isAvailable = canBookSlot(slot)
              const isBookable = isSlotBookable(slot) && isAvailable
              const showBookButton = isAvailable && isBookable

              return (
                <div 
                  key={slot.hour}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    backgroundColor: slot.isBooked ? '#FEE2E2' : isBookable ? '#D1FAE5' : '#F3F4F6',
                    border: slot.isBooked ? '1px solid #FCA5A5' : '1px solid var(--gray-200)',
                    flexWrap: 'wrap',
                    gap: '8px'
                  }}
                >
                  <div style={{ minWidth: '80px', fontWeight: 600 }}>
                    {formatTime(slot.startTime)}
                  </div>
                  
                  <div style={{ flex: 1 }}>
                    {slot.isBooked ? (
                      <span style={{ color: 'var(--danger)', fontWeight: 500 }}>
                        🔴 Booked by <strong>{slot.bookedBy || 'User'}</strong>
                      </span>
                    ) : isAvailable ? (
                      <span style={{ color: 'var(--success)', fontWeight: 500 }}>
                        🟢 Tersedia
                      </span>
                    ) : (
                      <span style={{ color: 'var(--gray-400)', fontWeight: 500 }}>
                        ⚪ Tidak tersedia untuk {duration} jam
                      </span>
                    )}
                  </div>

                  <div>
                    {showBookButton ? (
                      <button 
                        onClick={() => handleBook(slot)} 
                        className="btn btn-primary btn-sm"
                        style={{ width: 'auto', minHeight: '36px', padding: '6px 20px' }}
                        disabled={loading}
                      >
                        {loading ? '⏳' : 'Pesan'}
                      </button>
                    ) : slot.isBooked ? (
                      <span style={{ fontSize: '12px', color: 'var(--gray-400)' }}>Dipenuhi</span>
                    ) : (
                      <span style={{ fontSize: '12px', color: 'var(--gray-400)' }}>
                        {!isSlotBookable(slot) ? 'Min 1 jam sebelumnya' : ''}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
