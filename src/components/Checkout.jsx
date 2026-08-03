// src/components/Checkout.jsx

import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { createBookingWithCheckout } from '../lib/supabase'
import { useToast } from '../App'

export default function Checkout({ user }) {
  const navigate = useNavigate()
  const location = useLocation()
  const showToast = useToast()
  const [loading, setLoading] = useState(false)

  const { date, slot, duration } = location.state || {}

  // Debug: log what we received
  console.log('Checkout received:', { date, slot, duration })

  // Handle missing data
  if (!date || !slot || !duration) {
    console.error('Missing checkout data')
    navigate('/booking')
    return null
  }

  // Parse dates - handle both Date objects and ISO strings
  const startTime = slot.startTime instanceof Date 
    ? slot.startTime 
    : new Date(slot.startTime)
  
  const endTime = slot.endTime instanceof Date 
    ? slot.endTime 
    : new Date(slot.endTime)

  // Check if dates are valid
  if (isNaN(startTime.getTime()) || isNaN(endTime.getTime())) {
    console.error('Invalid date objects:', { startTime, endTime })
    navigate('/booking')
    return null
  }

  function formatTime(date) {
    return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  }

  function formatDateDisplay(date) {
    return date.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  }

  async function handleConfirmBooking() {
    setLoading(true)

    const { data, error } = await createBookingWithCheckout(
      user.id,
      { date: date.toISOString ? date.toISOString().split('T')[0] : date.split('T')[0], hour: slot.hour },
      duration
    )

    if (error) {
      showToast('❌ ' + error.message, 'error')
      setLoading(false)
      return
    }

    navigate('/confirmation', {
      state: { booking: data }
    })
  }

  return (
    <div className="container" style={{ paddingTop: '16px' }}>
      <div className="header" style={{ padding: '0 0 16px 0', borderBottom: '2px solid var(--gray-100)' }}>
        <div className="header-content" style={{ padding: 0 }}>
          <div className="logo">
            <span className="logo-icon">🏛️</span>
            <div>
              <span className="logo-text">Gedung Serbaguna BJP</span>
              <span className="logo-sub">Checkout</span>
            </div>
          </div>
          <button onClick={() => navigate('/booking')} className="btn btn-outline btn-sm" style={{ width: 'auto', minHeight: '36px', padding: '4px 16px' }}>
            ← Kembali
          </button>
        </div>
      </div>

      <div className="card" style={{ marginTop: '16px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '16px' }}>📋 Konfirmasi Pemesanan</h2>

        <div style={{ background: 'var(--primary-bg)', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--gray-200)' }}>
            <span style={{ color: 'var(--gray-600)' }}>📅 Tanggal</span>
            <span style={{ fontWeight: 600 }}>{formatDateDisplay(date instanceof Date ? date : new Date(date))}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--gray-200)' }}>
            <span style={{ color: 'var(--gray-600)' }}>⏰ Waktu</span>
            <span style={{ fontWeight: 600 }}>{formatTime(startTime)} - {formatTime(endTime)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--gray-200)' }}>
            <span style={{ color: 'var(--gray-600)' }}>⏱️ Durasi</span>
            <span style={{ fontWeight: 600 }}>{duration} Jam</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
            <span style={{ color: 'var(--gray-600)' }}>💰 Harga</span>
            <span style={{ fontWeight: 700, color: 'var(--success)' }}>Rp 0 (Gratis)</span>
          </div>
        </div>

        <div style={{ background: '#FEF3C7', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px' }}>
          <p style={{ fontSize: '14px', color: '#92400E' }}>
            ⚠️ Saat ini dalam mode <strong>Gratis</strong>. Tidak ada pembayaran yang diproses.
          </p>
        </div>

        <button 
          onClick={handleConfirmBooking} 
          className="btn btn-primary"
          disabled={loading}
        >
          {loading ? '⏳ Memproses...' : '✅ Konfirmasi Booking'}
        </button>

        <button 
          onClick={() => navigate('/booking')} 
          className="btn btn-outline"
          style={{ marginTop: '8px' }}
        >
          ← Kembali Pilih Slot
        </button>
      </div>
    </div>
  )
}
