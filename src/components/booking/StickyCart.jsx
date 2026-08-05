// src/components/booking/StickyCart.jsx

import React, { useState } from 'react'
import { formatPrice } from '../../lib/price'

function formatTime(date) {
  return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

export default function StickyCart({ range, totalPrice, selectedSlots, onClear, onCheckout, onRemoveSlot }) {
  const [isOpen, setIsOpen] = useState(false)

  if (!range) return null

  const { start, end, duration } = range
  const formattedDate = start.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short' })

  return (
    <div className="cart-wrap">
      <div className={`cart show ${isOpen ? 'open' : ''}`}>
        <div className="cart-handle"></div>
        <div className="cart-head" onClick={() => setIsOpen(!isOpen)}>
          <div className="cart-summary-left">
            <span className="cart-when">{formatTime(start)} – {formatTime(end)}</span>
            <span className="cart-meta">{duration} jam · {formattedDate}</span>
          </div>
          <div className="cart-right">
            <span className="cart-total">{formatPrice(totalPrice)}</span>
            <span className="chev">{isOpen ? '▼' : '▲'}</span>
          </div>
        </div>
        <div className="cart-body">
          <div className="chips">
            {selectedSlots.map((slot) => (
              <span key={slot.hour} className="chip">
                {formatTime(slot.startTime)}–{formatTime(slot.endTime)}
                <button onClick={() => onRemoveSlot(slot)} aria-label="Hapus jam">✕</button>
              </span>
            ))}
          </div>
        </div>
        <div className="cart-actions">
          <button className="btn btn-outline cart-clear" onClick={onClear}>✕</button>
          <button className="btn btn-primary" onClick={onCheckout}>Lanjut ke pembayaran →</button>
        </div>
      </div>
    </div>
  )
}
