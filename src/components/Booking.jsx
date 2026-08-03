import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, getBookingsForDate } from '../lib/supabase'
import { useToast } from '../App'

export default function Booking({ user }) {
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [bookingSlots, setBookingSlots] = useState([])
  const [selectedSlots, setSelectedSlots] = useState([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [showReasonModal, setShowReasonModal] = useState(false)
  const [closureReason, setClosureReason] = useState('')
  const [pendingAction, setPendingAction] = useState(null)
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

  useEffect(() => {
    const checkAdmin = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      setIsAdmin(data?.role === 'admin')
    }
    checkAdmin()
    loadBookings()

    // Real-time subscription for booking changes
    const subscription = supabase
      .channel('bookings-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bookings'
        },
        () => {
          loadBookings()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(subscription)
    }
  }, [selectedDate])

  function formatDateInput(date) {
    return date.toISOString().split('T')[0]
  }

  function parseDateInput(dateStr) {
    const parts = dateStr.split('-')
    return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]))
  }

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

      const booking = existingBookings.find(b => {
        const bStart = new Date(b.start_time)
        const bEnd = new Date(b.end_time)
        return startTime < bEnd && endTime > bStart
      })

      const isBooked = !!booking
      const isAdminBooking = booking?.is_admin_booking || false
      const isPast = isToday && startTime < now
      const closureReason = booking?.closure_reason || null

      // IMPORTANT: isAvailable is FALSE for ANY booking (admin or customer)
      const isAvailable = !isBooked && !isPast

      slots.push({
        hour,
        startTime,
        endTime,
        isBooked,
        isAdminBooking,
        isPast,
        isAvailable,
        bookedBy: booking?.profiles?.display_name || booking?.profiles?.full_name || null,
        bookingId: booking?.id || null,
        closureReason: closureReason
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

  // Customer: select slots
  function handleSlotClick(slot) {
    // BLOCKED: if slot is not available (includes admin bookings)
    if (!slot.isAvailable) {
      showToast('⚠️ Slot tidak tersedia', 'warning')
      return
    }

    if (selectedSlots.length === 2) {
      setSelectedSlots([])
      return
    }

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

  // Admin: toggle slot selection
  function handleAdminSlotToggle(slot) {
    if (!isAdmin) return
    if (slot.isBooked) return

    const index = selectedSlots.findIndex(s => s.hour === slot.hour)
    if (index >= 0) {
      const newSelected = [...selectedSlots]
      newSelected.splice(index, 1)
      setSelectedSlots(newSelected)
    } else {
      setSelectedSlots([...selectedSlots, slot])
    }
  }

  // Admin: close selected slots
  async function handleAdminClose() {
    if (selectedSlots.length === 0) {
      showToast('❌ Pilih slot terlebih dahulu', 'warning')
      return
    }

    setPendingAction('close')
    setClosureReason('')
    setShowReasonModal(true)
  }

  // Admin: close entire day
  async function handleCloseEntireDay() {
    const confirm = window.confirm(
      `⚠️ PERINGATAN!\n\n` +
      `Anda akan menutup SEMUA slot untuk hari ini:\n` +
      `${formatDateDisplay(selectedDate)}\n\n` +
      `Ini akan membatalkan semua booking customer yang sudah ada.\n\n` +
      `Lanjutkan?`
    )

    if (!confirm) return

    setPendingAction('closeAll')
    setClosureReason('')
    setShowReasonModal(true)
  }

  // Admin: reopen individual slot
  async function handleAdminReopen(slot) {
    if (!isAdmin) return
    if (!slot.isBooked) return
    if (!slot.isAdminBooking) {
      showToast('❌ Anda hanya bisa membuka slot admin sendiri', 'warning')
      return
    }

    const confirm = window.confirm(
      `Apakah Anda yakin ingin membuka slot ini?\n\n` +
      `${formatDateDisplay(selectedDate)}\n` +
      `${formatTime(slot.startTime)} - ${formatTime(slot.endTime)}`
    )

    if (!confirm) return

    try {
      const { error } = await supabase
        .from('bookings')
        .delete()
        .eq('id', slot.bookingId)

      if (error) {
        showToast('❌ Gagal membuka slot: ' + error.message, 'error')
        return
      }

      showToast('✅ Slot dibuka kembali', 'success')
      loadBookings()
    } catch (error) {
      showToast('❌ Gagal membuka slot', 'error')
    }
  }

  // Admin: reopen entire day
  async function handleReopenEntireDay() {
    if (!isAdmin) return

    const adminBookings = bookings.filter(b => b.is_admin_booking === true)
    if (adminBookings.length === 0) {
      showToast('ℹ️ Tidak ada slot admin untuk dibuka', 'info')
      return
    }

    const confirm = window.confirm(
      `Apakah Anda yakin ingin membuka SEMUA slot yang ditutup admin?\n\n` +
      `${formatDateDisplay(selectedDate)}\n` +
      `Jumlah slot: ${adminBookings.length}`
    )

    if (!confirm) return

    try {
      const ids = adminBookings.map(b => b.id)
      const { error } = await supabase
        .from('bookings')
        .delete()
        .in('id', ids)

      if (error) {
        showToast('❌ Gagal membuka slot: ' + error.message, 'error')
        return
      }

      showToast(`✅ ${ids.length} slot dibuka kembali`, 'success')
      loadBookings()
    } catch (error) {
      showToast('❌ Gagal membuka slot', 'error')
    }
  }

  // Execute admin action with reason
  async function executeAdminAction() {
    setShowReasonModal(false)

    try {
      if (pendingAction === 'close') {
        const slotsToClose = selectedSlots
        const bookingsToInsert = slotsToClose.map(slot => ({
          user_id: user.id,
          pin: null,
          start_time: slot.startTime.toISOString(),
          end_time: slot.endTime.toISOString(),
          duration_hours: 1,
          is_admin_booking: true,
          status: 'active', // ← FIXED: use 'active' instead of 'completed'
          price: 0,
          payment_status: 'free',
          payment_method: 'admin',
          closure_reason: closureReason || null
        }))

        const { error } = await supabase
          .from('bookings')
          .insert(bookingsToInsert)

        if (error) {
          showToast('❌ Gagal menutup slot: ' + error.message, 'error')
          return
        }

        showToast(`✅ ${slotsToClose.length} slot ditutup`, 'success')
        setSelectedSlots([])
        loadBookings()
      } else if (pendingAction === 'closeAll') {
        // Close entire day - delete all customer bookings first
        const customerBookings = bookings.filter(b => b.is_admin_booking === false)
        
        if (customerBookings.length > 0) {
          const ids = customerBookings.map(b => b.id)
          await supabase.from('bookings').delete().in('id', ids)
        }

        const allSlots = bookingSlots.filter(s => !s.isPast)
        const bookingsToInsert = allSlots.map(slot => ({
          user_id: user.id,
          pin: null,
          start_time: slot.startTime.toISOString(),
          end_time: slot.endTime.toISOString(),
          duration_hours: 1,
          is_admin_booking: true,
          status: 'active', // ← FIXED: use 'active' instead of 'completed'
          price: 0,
          payment_status: 'free',
          payment_method: 'admin',
          closure_reason: closureReason || 'Tutup Hari Ini'
        }))

        const { error } = await supabase
          .from('bookings')
          .insert(bookingsToInsert)

        if (error) {
          showToast('❌ Gagal menutup hari: ' + error.message, 'error')
          return
        }

        showToast(`✅ Hari ditutup (${allSlots.length} slot)`, 'success')
        setSelectedSlots([])
        loadBookings()
      }
    } catch (error) {
      showToast('❌ Gagal menjalankan aksi', 'error')
    }

    setPendingAction(null)
    setClosureReason('')
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
      setSelectedSlots([])
      loadBookings()
      return
    }

    navigate('/checkout', {
      state: {
        date: selectedDate,
        slot: {
          hour: selectedSlots[0].hour,
          startTime: range.start.toISOString(),
          endTime: range.end.toISOString()
        },
        duration: duration
      }
    })
  }

  const range = getSelectedStartEnd()
  const duration = getSelectedDuration()

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

      {/* Admin Controls */}
      {isAdmin && (
        <div className="card" style={{ background: '#FEF3C7', border: '1px solid var(--warning)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '14px', color: '#92400E', marginRight: '8px' }}>
              👑 Admin Mode
            </span>
            <button 
              onClick={handleCloseEntireDay} 
              className="btn btn-danger btn-sm"
              style={{ width: 'auto', minHeight: '36px', padding: '4px 16px', fontSize: '13px' }}
            >
              📅 Tutup Hari Ini
            </button>
            <button 
              onClick={handleReopenEntireDay} 
              className="btn btn-success btn-sm"
              style={{ width: 'auto', minHeight: '36px', padding: '4px 16px', fontSize: '13px' }}
            >
              📅 Buka Hari Ini
            </button>
            {selectedSlots.length > 0 && (
              <button 
                onClick={handleAdminClose} 
                className="btn btn-warning btn-sm"
                style={{ width: 'auto', minHeight: '36px', padding: '4px 16px', fontSize: '13px' }}
              >
                Tutup {selectedSlots.length} Slot
              </button>
            )}
          </div>
          {selectedSlots.length > 0 && (
            <div style={{ marginTop: '8px', fontSize: '13px', color: '#92400E' }}>
              ✅ {selectedSlots.length} slot dipilih
            </div>
          )}
        </div>
      )}

      {/* Reason Modal */}
      {showReasonModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999,
          padding: '16px'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '400px',
            width: '100%'
          }}>
            <h3 style={{ marginBottom: '12px' }}>⛔ Alasan Penutupan</h3>
            <p style={{ fontSize: '14px', color: 'var(--gray-500)', marginBottom: '12px' }}>
              Tambahkan alasan (opsional)
            </p>
            <input
              type="text"
              value={closureReason}
              onChange={(e) => setClosureReason(e.target.value)}
              placeholder="Contoh: Maintenance, Private Event, dll"
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '2px solid var(--gray-200)',
                borderRadius: '8px',
                fontSize: '14px',
                fontFamily: 'inherit',
                marginBottom: '16px'
              }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                onClick={() => { setShowReasonModal(false); setPendingAction(null); setClosureReason(''); }}
                className="btn btn-outline"
                style={{ flex: 1 }}
              >
                Batal
              </button>
              <button 
                onClick={executeAdminAction}
                className="btn btn-primary"
                style={{ flex: 1 }}
              >
                Konfirmasi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Selected Range Display (Customer only) */}
      {!isAdmin && selectedSlots.length > 0 && range && (
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

              if (isSelected && isAdmin) {
                bgColor = '#DBEAFE'
                borderColor = 'var(--primary)'
                textColor = 'var(--primary)'
              } else if (slot.isBooked) {
                if (slot.isAdminBooking) {
                  bgColor = '#FEF3C7'
                  borderColor = '#F59E0B'
                  textColor = '#92400E'
                } else {
                  bgColor = '#FEE2E2'
                  borderColor = '#FCA5A5'
                  textColor = 'var(--danger)'
                }
              } else {
                bgColor = '#D1FAE5'
                borderColor = 'var(--success)'
                textColor = 'var(--success)'
              }

              // Determine cursor based on role and slot state
              let cursor = 'default'
              if (isAdmin && slot.isAvailable) cursor = 'pointer'
              else if (isAdmin && slot.isBooked && slot.isAdminBooking) cursor = 'pointer'
              else if (!isAdmin && slot.isAvailable) cursor = 'pointer'

              return (
                <div 
                  key={slot.hour}
                  onClick={() => {
                    if (isAdmin && slot.isAvailable) {
                      handleAdminSlotToggle(slot)
                    } else if (!isAdmin && slot.isAvailable) {
                      handleSlotClick(slot)
                    } else if (isAdmin && slot.isBooked && slot.isAdminBooking) {
                      handleAdminReopen(slot)
                    } else if (!isAdmin && slot.isBooked) {
                      showToast('⚠️ Slot tidak tersedia', 'warning')
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    backgroundColor: bgColor,
                    border: `2px solid ${borderColor}`,
                    cursor: cursor,
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
                      slot.isAdminBooking ? (
                        <span style={{ color: '#92400E', fontWeight: 500 }}>
                          🔴 {slot.closureReason || 'Tidak Tersedia'} 
                          {isAdmin && ' (Admin)'}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--danger)', fontWeight: 500 }}>
                          🔴 Booked by <strong>{slot.bookedBy || 'User'}</strong>
                        </span>
                      )
                    ) : isSelected && isAdmin ? (
                      <span style={{ color: 'var(--primary)', fontWeight: 600 }}>
                        ✅ Dipilih
                      </span>
                    ) : isSelected && !isAdmin ? (
                      <span style={{ color: 'var(--primary)', fontWeight: 600 }}>
                        ✅ Dipilih
                      </span>
                    ) : (
                      <span style={{ color: 'var(--success)', fontWeight: 500 }}>
                        🟢 Tersedia
                      </span>
                    )}
                  </div>

                  {isSelected && !isAdmin && (
                    <span style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 600 }}>
                      {selectedSlots.length > 1 ? `(${selectedSlots.length} jam)` : `(1 jam)`}
                    </span>
                  )}

                  {isSelected && isAdmin && (
                    <span style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 600 }}>
                      ✓
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Book Button (Customer only) */}
      {!isAdmin && (
        <button 
          onClick={handleProceedToCheckout} 
          className="btn btn-primary"
          disabled={selectedSlots.length === 0 || loading}
          style={{ marginTop: '16px' }}
        >
          {selectedSlots.length === 0 ? 'Pilih slot terlebih dahulu' : '📖 Pesan Sekarang'}
        </button>
      )}
    </div>
  )
}
