import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getBookingsForDate } from '../lib/supabase'
import { useToast } from '../App'

export default function Booking({ user }) {
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [bookingSlots, setBookingSlots] = useState([])
  const [selectedSlots, setSelectedSlots] = useState([])
  const navigate = useNavigate()
  const showToast = useToast()

  const OPEN_HOUR = 7
  const CLOSE_HOUR = 23
  const MAX_DAYS_AHEAD = 14
  const SLOT_DURATION = 1

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const maxDate = new Date()
  maxDate.setDate(maxDate.getDate() + MAX_DAYS_AHEAD)
  maxDate.setHours(0, 0, 0, 0)

  function formatDateInput(date) {
    return date.toISOString().split('T')[0]
  }

  function parseDateInput(dateStr) {
    const parts = dateStr.split('-')
    return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]))
  }

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
    const now = new Date()
    const todayOnly = new Date()
    todayOnly.setHours(0, 0, 0, 0)
    
    const selectedDateOnly = new Date(selectedDate)
    selectedDateOnly.setHours(0, 0, 0, 0)

    const isToday = selectedDateOnly.getTime() === todayOnly.getTime()

    for (let hour = OPEN_HOUR; hour <= CLOSE_HOUR; hour++) {
      const startTime = new Date(selectedDate)
      startTime.setHours(hour, 0, 0, 0)
      
      const endTime = new Date(startTime)
      endTime.setHours(hour + SLOT_DURATION, 0, 0, 0)

      // Check if slot is already booked
      const isBooked = existingBookings.some(b => {
        const bStart = new Date(b.start_time)
        const bEnd = new Date(b.end_time)
        return startTime < bEnd && endTime > bStart
      })

      // Find who booked it
      const booking = existingBookings.find(b => {
        const bStart = new Date(b.start_time)
        const bEnd = new Date(b.end_time)
        return startTime >= bStart && startTime < bEnd
      })

      // Check if slot is in the past (for today)
      const isPast = isToday && startTime < now

      slots.push({
        hour,
        startTime,
        endTime,
        isBooked,
        isPast,
        isAvailable: !isBooked && !isPast,
        bookedBy: booking?.profiles?.display_name || booking?.profiles?.full_name || null,
        bookingId: booking?.id || null
      })
    }

    setBookingSlots(slots)
    setSelectedSlots([])
  }

  function formatTime(date) {
    return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  }

  function formatDateDisplay(date) {
    return date.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  }

  function handleDateChange(e) {
    const dateStr = e.target.value
    if (!dateStr) return
    
    const newDate = parseDateInput(dateStr)
    newDate.setHours(0, 0, 0, 0)
    
    const maxDateCheck = new Date()
    maxDateCheck.setDate(maxDateCheck.getDate() + MAX_DAYS_AHEAD)
    maxDateCheck.setHours(0, 0, 0, 0)
    
    if (newDate > maxDateCheck) {
      showToast(`❌ Maksimal booking ${MAX_DAYS_AHEAD} hari ke depan`, 'warning')
      return
    }
    
    const todayCheck = new Date()
    todayCheck.setHours(0, 0, 0, 0)
    
    if (newDate < todayCheck) {
      showToast('❌ Tidak bisa memilih tanggal yang sudah lewat', 'warning')
      return
    }
    
    setSelectedDate(newDate)
    setSelectedSlots([])
  }

  function handleSlotClick(slot) {
    if (!slot.isAvailable) return

    // Check if clicking the same slot to deselect
    if (selectedSlots.length === 1 && selectedSlots[0].hour === slot.hour) {
      setSelectedSlots([])
      return
    }

    if (selectedSlots.length === 0) {
      setSelectedSlots([slot])
      return
    }

    if (selectedSlots.length === 1) {
      const firstSlot = selectedSlots[0]
      
      const isAdjacent = slot.hour === firstSlot.hour + 1
      
      const nextSlot = bookingSlots.find(s => s.hour === firstSlot.hour + 1)
      const isNextAvailable = nextSlot && nextSlot.isAvailable
      
      if (isAdjacent && isNextAvailable && slot.hour === firstSlot.hour + 1) {
        setSelectedSlots([firstSlot, slot])
      } else {
        setSelectedSlots([slot])
      }
    }
  }

  function isSlotSelected(slot) {
    return selectedSlots.some(s => s.hour === slot.hour)
  }

  function getSelectedDuration() {
    if (selectedSlots.length === 0) return 0
    return selectedSlots.length * SLOT_DURATION
  }

  function getSelectedStartEnd() {
    if (selectedSlots.length === 0) return null
    const sorted = [...selectedSlots].sort((a, b) => a.hour - b.hour)
    return {
      start: sorted[0].startTime,
      end: sorted[sorted.length - 1].endTime,
      duration: sorted.length * SLOT_DURATION
    }
  }

  function handleProceedToCheckout() {
    if (selectedSlots.length === 0) {
      showToast('❌ Silakan pilih slot terlebih dahulu', 'warning')
      return
    }

    const duration = getSelectedDuration()
    const range = getSelectedStartEnd()

    const allAvailable = selectedSlots.every(s => s.isAvailable)
    if (!allAvailable) {
      showToast('❌ Beberapa slot sudah tidak tersedia', 'error')
      loadBookings()
      return
    }

    navigate('/checkout', {
      state: {
        date: selectedDate,
        slot: {
          hour: selectedSlots[0].hour,
          startTime: range.start,
          endTime: range.end
        },
        duration: duration
      }
    })
  }

  const range = getSelectedStartEnd()
  const duration = getSelectedDuration()

  // Filter slots: only show available or booked (but hide past)
  const visibleSlots = bookingSlots.filter(slot => !slot.isPast)

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

      {/* Date Picker */}
      <div className="card" style={{ marginTop: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <span style={{ fontWeight: 600, fontSize: '16px' }}>
            📅 {formatDateDisplay(selectedDate)}
          </span>
          <input
            type="date"
            value={formatDateInput(selectedDate)}
            onChange={handleDateChange}
            min={formatDateInput(today)}
            max={formatDateInput(maxDate)}
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              border: '2px solid var(--gray-200)',
              fontSize: '14px',
              fontFamily: 'inherit',
              background: 'var(--white)',
              cursor: 'pointer'
            }}
          />
        </div>
      </div>

      {/* Selected Range Display */}
      {selectedSlots.length > 0 && range && (
        <div className="card" style={{ background: 'var(--primary-bg)', border: '1px solid var(--primary)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <span style={{ fontWeight: 600 }}>
                ✅ {formatTime(range.start)} - {formatTime(range.end)}
              </span>
              <span style={{ marginLeft: '8px', fontSize: '14px', color: 'var(--gray-500)' }}>
                ({duration} jam)
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Slots */}
      <div className="card">
        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>
          📋 Daftar Slot
          {loading && <span style={{ fontSize: '12px', color: 'var(--gray-400)', marginLeft: '8px' }}>⏳ Memuat...</span>}
        </h3>

        {visibleSlots.length === 0 && !loading ? (
          <p style={{ color: 'var(--gray-400)', textAlign: 'center', padding: '20px' }}>
            {selectedDate.toDateString() === new Date().toDateString() 
              ? '⏰ Tidak ada slot tersisa untuk hari ini' 
              : 'Tidak ada slot untuk hari ini'}
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {visibleSlots.map((slot) => {
              const isSelected = isSlotSelected(slot)

              let bgColor = '#F3F4F6'
              let borderColor = 'var(--gray-200)'
              let textColor = 'var(--gray-600)'

              if (isSelected) {
                bgColor = '#DBEAFE'
                borderColor = 'var(--primary)'
                textColor = 'var(--primary)'
              } else if (slot.isBooked) {
                bgColor = '#FEE2E2'
                borderColor = '#FCA5A5'
                textColor = 'var(--danger)'
              } else {
                bgColor = '#D1FAE5'
                borderColor = 'var(--success)'
                textColor = 'var(--success)'
              }

              return (
                <div 
                  key={slot.hour}
                  onClick={() => handleSlotClick(slot)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    backgroundColor: bgColor,
                    border: `2px solid ${borderColor}`,
                    cursor: slot.isAvailable ? 'pointer' : 'default',
                    flexWrap: 'wrap',
                    gap: '8px',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ fontWeight: 600, color: textColor }}>
                    {formatTime(slot.startTime)} - {formatTime(slot.endTime)}
                  </div>
                  
                  <div style={{ flex: 1 }}>
                    {slot.isBooked ? (
                      <span style={{ color: 'var(--danger)', fontWeight: 500 }}>
                        🔴 Booked by <strong>{slot.bookedBy || 'User'}</strong>
                      </span>
                    ) : isSelected ? (
                      <span style={{ color: 'var(--primary)', fontWeight: 600 }}>
                        ✅ Dipilih
                      </span>
                    ) : (
                      <span style={{ color: 'var(--success)', fontWeight: 500 }}>
                        🟢 Tersedia
                      </span>
                    )}
                  </div>

                  {isSelected && (
                    <span style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 600 }}>
                      {selectedSlots.length > 1 ? `(2 jam)` : `(1 jam)`}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Book Button */}
      <button 
        onClick={handleProceedToCheckout} 
        className="btn btn-primary"
        disabled={selectedSlots.length === 0 || loading}
        style={{ marginTop: '16px' }}
      >
        {selectedSlots.length === 0 ? 'Pilih slot terlebih dahulu' : '📖 Pesan Sekarang'}
      </button>
    </div>
  )
}
