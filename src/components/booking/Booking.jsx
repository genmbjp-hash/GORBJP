import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, getBookingsForDate, completeExpiredBookings } from '../../lib/supabase'
import { useToast } from '../../hooks/useToast'
import { calculatePrice, formatPrice } from '../../lib/price'
import SlotList from './SlotList'
import StickyCart from './StickyCart'
import CheckoutSheet from '../checkout/CheckoutSheet'
import PaymentSheet from '../payment/PaymentSheet'
import Legend from './Legend'

export default function Booking({ user }) {
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [bookingSlots, setBookingSlots] = useState([])
  const [selectedSlots, setSelectedSlots] = useState([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [showCheckout, setShowCheckout] = useState(false)
  const [showPayment, setShowPayment] = useState(false)
  const [bookingData, setBookingData] = useState(null)
  const [voucher, setVoucher] = useState(null)
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

  function formatDateDisplay(date) {
    if (!date) return ''
    const dateObj = typeof date === 'string' ? new Date(date + 'T00:00:00') : date
    return dateObj.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  }

  function formatTime(date) {
    return date.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Jakarta'
    })
  }

  function handleDateChange(e) {
    const dateStr = e.target.value
    if (!dateStr) return
    const newDate = new Date(dateStr + 'T00:00:00')
    setSelectedDate(newDate)
    setSelectedSlots([])
  }

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
    
    const updateAndLoad = async () => {
      await completeExpiredBookings()
      await loadBookings()
    }
    updateAndLoad()

    const subscription = supabase
      .channel('bookings-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => loadBookings())
      .subscribe()

    return () => supabase.removeChannel(subscription)
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
    const isToday = selectedDate.toDateString() === new Date().toDateString()

    for (let hour = OPEN_HOUR; hour <= CLOSE_HOUR; hour++) {
      const startTime = new Date(selectedDate)
      startTime.setHours(hour, 0, 0, 0)
      const endTime = new Date(startTime)
      endTime.setHours(hour + SLOT_DURATION, 0, 0, 0)

      const booking = existingBookings.find(b => {
        const bStart = new Date(b.start_time)
        const bEnd = new Date(b.end_time)
        const sameDate = bStart.toDateString() === selectedDate.toDateString()
        return sameDate && startTime < bEnd && endTime > bStart
      })

      const isBooked = !!booking
      const isAdminBooking = booking?.is_admin_booking || false
      const isPast = isToday && startTime < now
      const closureReason = booking?.closure_reason || null

      slots.push({
        hour,
        startTime,
        endTime,
        isBooked,
        isAdminBooking,
        isPast,
        isAvailable: !isBooked && !isPast,
        bookedBy: booking?.profiles?.display_name || booking?.profiles?.full_name || null,
        bookingId: booking?.id || null,
        closureReason
      })
    }

    setBookingSlots(slots)
    setSelectedSlots([])
  }

  function handleSlotClick(slot) {
    if (!slot.isAvailable || slot.isAdminBooking) {
      showToast('⚠️ Slot tidak tersedia', 'warning')
      return
    }

    if (selectedSlots.length === 0) {
      setSelectedSlots([slot])
      return
    }

    const lastSlot = selectedSlots[selectedSlots.length - 1]
    const isConsecutive = slot.hour === lastSlot.hour + 1
    const gapSlot = bookingSlots.find(s => s.hour === lastSlot.hour + 1)
    const isGapAvailable = gapSlot && gapSlot.isAvailable && !gapSlot.isAdminBooking

    if (isConsecutive && isGapAvailable) {
      setSelectedSlots([...selectedSlots, slot])
    } else {
      setSelectedSlots([slot])
    }
  }

  function removeSlot(slot) {
    const index = selectedSlots.findIndex(s => s.hour === slot.hour)
    if (index >= 0) {
      const newSelected = [...selectedSlots]
      newSelected.splice(index, 1)
      setSelectedSlots(newSelected)
    }
  }

  function isSlotSelected(slot) {
    return selectedSlots.some(s => s.hour === slot.hour)
  }

  function getSelectedDuration() {
    return selectedSlots.length
  }

  function getSelectedRange() {
    if (selectedSlots.length === 0) return null
    const sorted = [...selectedSlots].sort((a, b) => a.hour - b.hour)
    return {
      start: sorted[0].startTime,
      end: sorted[sorted.length - 1].endTime,
      duration: sorted.length,
      hours: sorted.map(s => s.hour)
    }
  }

  function getTotalPrice() {
    const duration = getSelectedDuration()
    return calculatePrice(duration)
  }

  function handleProceedToCheckout() {
    if (selectedSlots.length === 0) {
      showToast('❌ Pilih slot terlebih dahulu', 'warning')
      return
    }
    const sorted = [...selectedSlots].sort((a, b) => a.hour - b.hour)
    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i + 1].hour !== sorted[i].hour + 1) {
        showToast('❌ Slot harus berurutan', 'warning')
        return
      }
    }
    setShowCheckout(true)
  }

  function handleAdminSlotToggle(slot) {
    if (!isAdmin || slot.isBooked) return
    const index = selectedSlots.findIndex(s => s.hour === slot.hour)
    if (index >= 0) {
      const newSelected = [...selectedSlots]
      newSelected.splice(index, 1)
      setSelectedSlots(newSelected)
    } else {
      setSelectedSlots([...selectedSlots, slot].sort((a, b) => a.hour - b.hour))
    }
  }

  function handleAdminClose() {
    if (selectedSlots.length === 0) {
      showToast('❌ Pilih slot terlebih dahulu', 'warning')
      return
    }
    setPendingAction('close')
    setClosureReason('')
    setShowReasonModal(true)
  }

  function handleCloseEntireDay() {
    if (!window.confirm(`⚠️ PERINGATAN!\n\nAnda akan menutup SEMUA slot untuk hari ini:\n${formatDateDisplay(selectedDate)}\n\nIni akan membatalkan semua booking customer yang sudah ada.\n\nLanjutkan?`)) return
    setPendingAction('closeAll')
    setClosureReason('')
    setShowReasonModal(true)
  }

  async function executeAdminAction() {
    setShowReasonModal(false)
    try {
      if (pendingAction === 'close') {
        const bookingsToInsert = selectedSlots.map(slot => ({
          user_id: user.id,
          pin: null,
          start_time: slot.startTime.toISOString(),
          end_time: slot.endTime.toISOString(),
          duration_hours: 1,
          is_admin_booking: true,
          status: 'active',
          price: 0,
          payment_status: 'free',
          payment_method: 'admin',
          closure_reason: closureReason || null
        }))
        const { error } = await supabase.from('bookings').insert(bookingsToInsert)
        if (error) {
          showToast('❌ Gagal menutup slot: ' + error.message, 'error')
          return
        }
        showToast(`✅ ${selectedSlots.length} slot ditutup`, 'success')
        setSelectedSlots([])
        loadBookings()
      } else if (pendingAction === 'closeAll') {
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
          status: 'active',
          price: 0,
          payment_status: 'free',
          payment_method: 'admin',
          closure_reason: closureReason || 'Tutup Hari Ini'
        }))
        const { error } = await supabase.from('bookings').insert(bookingsToInsert)
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

  async function handleAdminReopen(slot) {
    if (!isAdmin || !slot.isBooked || !slot.isAdminBooking) {
      showToast('❌ Anda hanya bisa membuka slot admin sendiri', 'warning')
      return
    }
    if (!window.confirm(`Apakah Anda yakin ingin membuka slot ini?\n\n${formatDateDisplay(selectedDate)}\n${formatTime(slot.startTime)} - ${formatTime(slot.endTime)}`)) return

    const { error } = await supabase.from('bookings').delete().eq('id', slot.bookingId)
    if (error) {
      showToast('❌ Gagal membuka slot: ' + error.message, 'error')
      return
    }
    showToast('✅ Slot dibuka kembali', 'success')
    loadBookings()
  }

  async function handleReopenEntireDay() {
    if (!isAdmin) return
    const adminBookings = bookings.filter(b => b.is_admin_booking === true)
    if (adminBookings.length === 0) {
      showToast('ℹ️ Tidak ada slot admin untuk dibuka', 'info')
      return
    }
    if (!window.confirm(`Apakah Anda yakin ingin membuka SEMUA slot yang ditutup admin?\n\n${formatDateDisplay(selectedDate)}\nJumlah slot: ${adminBookings.length}`)) return

    const ids = adminBookings.map(b => b.id)
    const { error } = await supabase.from('bookings').delete().in('id', ids)
    if (error) {
      showToast('❌ Gagal membuka slot: ' + error.message, 'error')
      return
    }
    showToast(`✅ ${ids.length} slot dibuka kembali`, 'success')
    loadBookings()
  }

  const range = getSelectedRange()
  const totalPrice = getTotalPrice()
  const visibleSlots = bookingSlots.filter(slot => !slot.isPast)

  return (
    <div className="container" style={{ paddingTop: '16px', paddingBottom: '140px' }}>
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <span style={{ fontWeight: 600, fontSize: '16px' }}>
            📅 {formatDateDisplay(selectedDate)}
          </span>
          <input
            type="date"
            value={selectedDate.toISOString().split('T')[0]}
            onChange={handleDateChange}
            min={today.toISOString().split('T')[0]}
            max={maxDate.toISOString().split('T')[0]}
            className="date-input"
          />
        </div>
      </div>

      {isAdmin && (
        <div className="card" style={{ background: '#FEF3C7', border: '1px solid var(--warning)' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '14px', color: '#92400E', marginRight: '8px' }}>👑 Admin Mode</span>
            <button onClick={handleCloseEntireDay} className="btn btn-danger btn-sm" style={{ width: 'auto', minHeight: '36px', padding: '4px 16px', fontSize: '13px' }}>📅 Tutup Hari Ini</button>
            <button onClick={handleReopenEntireDay} className="btn btn-success btn-sm" style={{ width: 'auto', minHeight: '36px', padding: '4px 16px', fontSize: '13px' }}>📅 Buka Hari Ini</button>
            {selectedSlots.length > 0 && (
              <button onClick={handleAdminClose} className="btn btn-warning btn-sm" style={{ width: 'auto', minHeight: '36px', padding: '4px 16px', fontSize: '13px' }}>
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
              <button onClick={() => { setShowReasonModal(false); setPendingAction(null); setClosureReason(''); }} className="btn btn-outline" style={{ flex: 1 }}>Batal</button>
              <button onClick={executeAdminAction} className="btn btn-primary" style={{ flex: 1 }}>Konfirmasi</button>
            </div>
          </div>
        </div>
      )}

      <SlotList
        slots={bookingSlots}
        isSelected={isSlotSelected}
        onToggle={handleSlotClick}
        isAdmin={isAdmin}
        onAdminClose={handleAdminClose}
        onAdminToggle={handleAdminSlotToggle}
      />

      <Legend />

      <StickyCart
        range={range}
        totalPrice={totalPrice}
        selectedSlots={selectedSlots}
        onClear={() => setSelectedSlots([])}
        onCheckout={handleProceedToCheckout}
        onRemoveSlot={removeSlot}
      />

      <CheckoutSheet
        isOpen={showCheckout}
        onClose={() => setShowCheckout(false)}
        range={range}
        totalPrice={totalPrice}
        selectedDate={selectedDate}
        user={user}
        voucher={voucher}
        onVoucherChange={setVoucher}
        onPayment={() => {
          setShowCheckout(false)
          setShowPayment(true)
        }}
        onBookingCreated={(data) => {
          setBookingData(data)
          setSelectedSlots([])
        }}
      />

      <PaymentSheet
        isOpen={showPayment}
        onClose={() => setShowPayment(false)}
        booking={bookingData}
        user={user}
      />
    </div>
  )
}
