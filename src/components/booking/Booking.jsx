// src/components/booking/Booking.jsx

import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useSlotSelection } from '../../hooks/useSlotSelection'
import { useToast } from '../../hooks/useToast'
import { calculatePrice, formatPrice } from '../../lib/price'
import SlotList from './SlotList'
import StickyCart from './StickyCart'
import CheckoutSheet from '../checkout/CheckoutSheet'
import PaymentSheet from '../payment/PaymentSheet'
import Legend from './Legend'

const OPEN_HOUR = 7
const CLOSE_HOUR = 23
const MAX_DAYS_AHEAD = 14

export default function Booking() {
  // ✅ Get user from useAuth (not from props)
  const { user } = useAuth()
  const navigate = useNavigate()

  const [selectedDate, setSelectedDate] = useState(new Date())
  const [bookingSlots, setBookingSlots] = useState([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [showCheckout, setShowCheckout] = useState(false)
  const [showPayment, setShowPayment] = useState(false)
  const [bookingData, setBookingData] = useState(null)
  const [voucher, setVoucher] = useState(null)

  const { selectedSlots, toggleSlot, clearSelection, getSelectedRange, isSelected } = useSlotSelection()
  const { showToast } = useToast()

  // ✅ Redirect if no user
  useEffect(() => {
    if (!user) {
      navigate('/login')
    }
  }, [user, navigate])

  const range = getSelectedRange()
  const totalPrice = range ? calculatePrice(range.duration) : 0

  useEffect(() => {
    if (!user) return

    const checkAdmin = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      setIsAdmin(data?.role === 'admin')
    }
    checkAdmin()
    loadSlots()
  }, [selectedDate, user])

  async function loadSlots() {
    setLoading(true)
    const dateStr = selectedDate.toISOString().split('T')[0]
    const startOfDay = new Date(dateStr)
    startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(dateStr)
    endOfDay.setHours(23, 59, 59, 999)

    const { data, error } = await supabase
      .from('bookings')
      .select('*, profiles(display_name, full_name)')
      .gte('start_time', startOfDay.toISOString())
      .lte('start_time', endOfDay.toISOString())
      .in('status', ['pending', 'active', 'completed'])

    if (error) {
      showToast('❌ Gagal memuat slot', 'error')
      setLoading(false)
      return
    }

    generateSlots(data || [])
    setLoading(false)
  }

  function generateSlots(existingBookings) {
    const slots = []
    const now = new Date()
    const dateObj = new Date(selectedDate)
    const isToday = dateObj.toDateString() === new Date().toDateString()

    for (let hour = OPEN_HOUR; hour <= CLOSE_HOUR; hour++) {
      const startTime = new Date(dateObj)
      startTime.setHours(hour, 0, 0, 0)
      const endTime = new Date(startTime)
      endTime.setHours(hour + 1, 0, 0, 0)

      const booking = existingBookings.find(b => {
        const bStart = new Date(b.start_time)
        const bEnd = new Date(b.end_time)
        return startTime < bEnd && endTime > bStart
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
        closureReason,
      })
    }

    setBookingSlots(slots)
  }

  function handleProceedToCheckout() {
    if (!range) {
      showToast('❌ Pilih slot terlebih dahulu', 'warning')
      return
    }
    setShowCheckout(true)
  }

  if (!user) {
    return null
  }

  const todayStr = new Date().toISOString().split('T')[0]
  const maxDateStr = new Date(Date.now() + MAX_DAYS_AHEAD * 86400000).toISOString().split('T')[0]

  return (
    <div className="container" style={{ paddingTop: '16px', paddingBottom: '140px' }}>
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
            📅 {selectedDate.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
          <input
            type="date"
            value={selectedDate.toISOString().split('T')[0]}
            onChange={(e) => setSelectedDate(new Date(e.target.value + 'T00:00:00'))}
            min={todayStr}
            max={maxDateStr}
            className="date-input"
          />
        </div>
      </div>

      {/* Admin Mode Badge */}
      {isAdmin && (
        <div className="card" style={{ background: '#FEF3C7', border: '1px solid var(--warning)' }}>
          <p style={{ fontSize: '14px', color: '#92400E', margin: 0 }}>
            👑 Mode Admin — Anda dapat menutup slot untuk keperluan venue
          </p>
        </div>
      )}

      {/* Slot List */}
      <div className="card">
        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>
          📋 Pilih Jam Sewa
          {loading && <span style={{ fontSize: '12px', color: 'var(--gray-400)', marginLeft: '8px' }}>⏳ Memuat...</span>}
        </h3>

        <SlotList
          slots={bookingSlots}
          isSelected={isSelected}
          onToggle={toggleSlot}
          isAdmin={isAdmin}
          onAdminClose={() => {}}
        />

        <Legend />
        <p style={{ fontSize: '12px', color: 'var(--gray-400)', marginTop: '10px' }}>
          💡 Pilih jam berurutan untuk booking beberapa jam sekaligus
        </p>
      </div>

      {/* Sticky Cart */}
      <StickyCart
        range={range}
        totalPrice={totalPrice}
        selectedSlots={selectedSlots}
        onClear={clearSelection}
        onCheckout={handleProceedToCheckout}
        onRemoveSlot={toggleSlot}
      />

      {/* Checkout Sheet */}
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
          clearSelection()
        }}
      />

      {/* Payment Sheet */}
      <PaymentSheet
        isOpen={showPayment}
        onClose={() => setShowPayment(false)}
        booking={bookingData}
        user={user}
      />
    </div>
  )
}
