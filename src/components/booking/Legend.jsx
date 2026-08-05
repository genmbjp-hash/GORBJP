// src/components/booking/Legend.jsx

import React from 'react'

export default function Legend() {
  return (
    <div className="legend">
      <span><i className="dot" style={{ background: 'var(--success)' }}></i>Tersedia</span>
      <span><i className="dot" style={{ background: 'var(--primary)' }}></i>Dipilih</span>
      <span><i className="dot" style={{ background: '#FCA5A5' }}></i>Sudah dibooking</span>
      <span><i className="dot" style={{ background: '#F59E0B' }}></i>Ditutup</span>
    </div>
  )
}
