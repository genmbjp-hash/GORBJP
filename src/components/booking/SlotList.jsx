// src/components/booking/SlotList.jsx

import React from 'react'
import SlotItem from './SlotItem'

export default function SlotList({ slots, isSelected, onToggle, isAdmin }) {
  const visibleSlots = slots.filter(slot => !slot.isPast)

  if (visibleSlots.length === 0) {
    return (
      <p style={{ color: 'var(--gray-400)', textAlign: 'center', padding: '20px' }}>
        ⏰ Tidak ada slot tersisa untuk hari ini
      </p>
    )
  }

  return (
    <div className="slot-list">
      {visibleSlots.map((slot) => (
        <SlotItem
          key={slot.hour}
          slot={slot}
          isSelected={isSelected(slot)}
          onToggle={onToggle}
          isAdmin={isAdmin}
        />
      ))}
    </div>
  )
}
