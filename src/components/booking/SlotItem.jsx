// src/components/booking/SlotList.jsx

import React from 'react'
import SlotItem from './SlotItem'

export default function SlotList({ slots, isSelected, onToggle, isAdmin }) {
  const visibleSlots = slots.filter(slot => !slot.isPast)

  if (!slots || slots.length === 0) {
    return (
      <p style={{ color: 'var(--gray-400)', textAlign: 'center', padding: '20px' }}>
        ⏰ Tidak ada slot tersisa untuk hari ini
      </p>
    )
  }

  if (visibleSlots.length === 0) {
    return (
      <div className="slot-list">
        {slots.map((slot) => (
          <SlotItem
            key={slot.hour}
            slot={slot}
            isSelected={isSelected(slot)}
            onToggle={onToggle}
            isAdmin={isAdmin}
            // ✅ onAdminToggle removed
          />
        ))}
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
          isSelected={isSelected(slot)}
          onToggle={onToggle}
          isAdmin={isAdmin}
          // ✅ onAdminToggle removed
        />
      ))}
    </div>
  )
}
