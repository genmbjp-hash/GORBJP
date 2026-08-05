// src/components/booking/SlotList.jsx

import React from 'react'
import SlotItem from './SlotItem'

export default function SlotList({ slots = [], isSelected, onToggle, isAdmin }) {
  // Safety check: if slots is undefined or null, use empty array
  const safeSlots = slots || []
  const visibleSlots = safeSlots.filter(slot => !slot.isPast)

  if (safeSlots.length === 0) {
    return (
      <p style={{ color: 'var(--gray-400)', textAlign: 'center', padding: '20px' }}>
        ⏰ Tidak ada slot tersisa untuk hari ini
      </p>
    )
  }

  if (visibleSlots.length === 0) {
    return (
      <div>
        <div className="slot-list">
          {safeSlots.map((slot) => (
            <SlotItem
              key={slot.hour}
              slot={slot}
              isSelected={isSelected ? isSelected(slot) : false}
              onToggle={onToggle}
              isAdmin={isAdmin}
            />
          ))}
        </div>
        <p style={{ color: 'var(--gray-400)', textAlign: 'center', padding: '8px', fontSize: '13px' }}>
          ⏰ Semua slot untuk hari ini sudah lewat
        </p>
      </div>
    )
  }

  return (
    <div className="slot-list">
      {visibleSlots.map((slot) => (
        <SlotItem
          key={slot.hour}
          slot={slot}
          isSelected={isSelected ? isSelected(slot) : false}
          onToggle={onToggle}
          isAdmin={isAdmin}
        />
      ))}
    </div>
  )
}
