import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getBookingsForDate } from '../lib/supabase'
import { useToast } from '../App'

export default function Booking({ user }) {
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [duration, setDuration] = useState(1)
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [bookingSlots, setBookingSlots] = useState([])
  const [selectedSlot, setSelectedSlot] = useState(null)
  const navigate = useNavigate()
  const showToast = useToast()

  const OPEN_HOUR = 7
  const CLOSE_HOUR = 23

  useEffect(() => {
    loadBookings()
  }, [selectedDate])

  async function loadBookings() {
    setLoading(true)
    const { data, error } = await getBookingsForDate(selectedDate)

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

    for (let hour = OPEN_HOUR; hour <= CLOSE_HOUR; hour++) {
      const startTime = new Date(selectedDate)
      startTime.setHours(hour, 0, 0, 0)
      
      const endTime1 = new Date(startTime)
      endTime1.setHours(hour + 1, 0, 0)
      
      const endTime2 = new Date(startTime)
      endTime2.setHours(hour + 2, 0, 0)

      const isAvailable1 = !existingBookings.some(b => {
        const bStart = new Date(b.start_time)
        const bEnd = new Date(b.end_time)
        return startTime < bEnd && endTime1 > bStart
      })

      const isAvailable2 = !existingBookings.some(b => {
        const bStart = new Date(b.start_time)
        const bEnd = new Date(b.end_time)
        return startTime < bEnd && endTime2 > bStart
      })

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

  function handleProceedToCheckout(slot) {
    // Check if slot is available for selected duration
    const isAvailable = duration === 1 ? slot.isAvailable1 : slot.isAvailable2
    if (!isAvailable) {
      showToast(`❌ Slot tidak tersedia untuk ${duration} jam`, 'error')
      return
    }

    // Check if slot starts at least 1 hour from now
    const now = new Date()
    const minStartTime = new Date(now.getTime() + 60 * 60 * 1000)
    if (slot.startTime < minStartTime) {
      showToast('❌ Minimal booking 1 jam sebelum slot dimulai', 'error')
      return
    }

    // Navigate to checkout with slot data
    navigate('/checkout', {
      state: {
        date: selectedDate,
        slot: slot,
        duration: duration
      }
    })
  }

  function canBookSlot(slot) {
    if (duration === 1) return slot.isAvailable1
    if (duration === 2) return slot.isAvailable2
    return false
  }

  function isSlotBookable(slot) {
    const now = new Date()
    const minStartTime = new Date(now.getTime() + 60 * 60 * 1000)
    return slot.startTime >= minStartTime
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

              return (
                <div 
                  key={slot.hour}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    backgroundColor: slot.isBooked ? '#FEE2E2' : isAvailable ? '#D1FAE5' : '#F3F4F6',
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
                    {isBookable ? (
                      <button 
                        onClick={() => handleProceedToCheckout(slot)} 
                        className="btn btn-primary btn-sm"
                        style={{ width: 'auto', minHeight: '36px', padding: '6px 20px' }}
                      >
                        Pesan
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
