// src/components/booking/SlotItem.jsx

import React from 'react'

function formatTime(date) {
  return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

export default function SlotItem({ slot, isSelected, onToggle, isAdmin }) {
  const { startTime, endTime, isBooked, isAdminBooking, isAvailable, bookedBy, closureReason } = slot

  let className = 'slot'
  let stateText = ''

  if (isSelected) {
    className += ' selected'
    stateText = '✅ Dipilih'
  } else if (isBooked) {
    if (isAdminBooking) {
      className += ' admin'
      stateText = closureReason || '🔴 Tidak tersedia'
    } else {
      className += ' booked'
      stateText = `🔴 Booked by ${bookedBy || 'User'}`
    }
  } else {
    className += ' available'
    stateText = '🟢 Tersedia'
  }

  const isClickable = isAvailable && !isBooked

  return (
    <button
      className={className}
      onClick={() => isClickable && onToggle(slot)}
      disabled={!isClickable}
      aria-pressed={isSelected}
      type="button"
    >
      <span className="slot-time">{formatTime(startTime)} - {formatTime(endTime)}</span>
      <span className="slot-state">{stateText}</span>
      {isSelected && <span className="slot-check">✓</span>}
    </button>
  )
}
