import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { 
  supabase, 
  createPendingBooking, 
  cancelExpiredPendingBookings, 
  validateVoucher, 
  calculateDiscount, 
  calculateFinalPrice,
  createBookingWithVoucher 
} from '../lib/supabase'
import { useToast } from '../App'

export default function Checkout({ user }) {
  const navigate = useNavigate()
  const location = useLocation()
  const showToast = useToast()
  const [loading, setLoading] = useState(false)
  const [voucherCode, setVoucherCode] = useState('')
  const [voucherApplied, setVoucherApplied] = useState(null)
  const [voucherError, setVoucherError] = useState('')
  const [applyingVoucher, setApplyingVoucher] = useState(false)

  const { date, slot, duration, price } = location.state || {}

  if (!date || !slot || !duration) {
    navigate('/booking')
    return null
  }

  const startTime = new Date(slot.startTime)
  const endTime = new Date(slot.endTime)
  const originalPrice = price
  const finalPrice = voucherApplied ? calculateFinalPrice(originalPrice, voucherApplied) : originalPrice
  const discountAmount = voucherApplied ? calculateDiscount(originalPrice, voucherApplied) : 0

  function formatTime(date) {
    return date.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Jakarta'
    })
  }

  function formatDateDisplay(dateStr) {
    const parts = dateStr.split('-')
    const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]))
    return date.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  }

  function formatDiscountLabel(voucher) {
    if (!voucher) return ''
    if (voucher.discount_type === 'free') return 'Gratis (100%)'
    if (voucher.discount_type === 'percentage') return `${voucher.discount_value}%`
    if (voucher.discount_type === 'fixed') return `Rp ${voucher.discount_value.toLocaleString()}`
    return ''
  }

  async function handleApplyVoucher() {
    if (!voucherCode.trim()) {
      setVoucherError('Masukkan kode voucher')
      return
    }

    setApplyingVoucher(true)
    setVoucherError('')

    const { data, error } = await validateVoucher(voucherCode, duration)

    if (error || !data) {
      setVoucherError(error?.message || 'Kode voucher tidak valid')
      setApplyingVoucher(false)
      return
    }

    setVoucherApplied(data)
    showToast(`✅ Voucher "${data.code}" diterapkan!`, 'success')
    setApplyingVoucher(false)
  }

  async function handleConfirmBooking() {
    setLoading(true)

    await cancelExpiredPendingBookings()

    let result

    if (voucherApplied) {
      // Create booking with voucher (free or discounted)
      const { data, error } = await createBookingWithVoucher(
        user.id,
        { date: date, hour: slot.hour },
        duration,
        voucherApplied.id
      )

      if (error) {
        showToast('❌ ' + error.message, 'error')
        setLoading(false)
        return
      }

      navigate('/payment-success', {
        state: { booking: data }
      })
    } else {
      // Create pending booking (manual payment)
      const { data, error } = await createPendingBooking(
        user.id,
        { date: date, hour: slot.hour },
        duration,
        finalPrice
      )

      if (error) {
        showToast('❌ ' + error.message, 'error')
        setLoading(false)
        return
      }

      navigate('/payment', {
        state: {
          bookingId: data.id,
          date: date,
          slot: slot,
          duration: duration,
          price: finalPrice,
          originalPrice: originalPrice,
          discountAmount: discountAmount
        }
      })
    }

    setLoading(false)
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
            <span style={{ fontWeight: 600 }}>{formatDateDisplay(date)}</span>
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
            <span style={{ color: 'var(--gray-600)' }}>💰 Total</span>
            <span style={{ fontWeight: 700, color: voucherApplied ? 'var(--success)' : 'var(--primary)', fontSize: '18px' }}>
              {voucherApplied ? (
                <>
                  <span style={{ textDecoration: 'line-through', color: 'var(--gray-400)', marginRight: '8px' }}>
                    Rp {originalPrice.toLocaleString()}
                  </span>
                  Rp {finalPrice.toLocaleString()}
                </>
              ) : (
                `Rp ${originalPrice.toLocaleString()}`
              )}
            </span>
          </div>
          {voucherApplied && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', marginTop: '4px', borderTop: '1px solid var(--gray-200)' }}>
              <span style={{ color: 'var(--gray-600)' }}>🎫 Diskon</span>
              <span style={{ fontWeight: 600, color: 'var(--success)' }}>
                - Rp {discountAmount.toLocaleString()} ({formatDiscountLabel(voucherApplied)})
              </span>
            </div>
          )}
        </div>

        {/* Voucher Section */}
        <div style={{ marginBottom: '16px', padding: '16px', background: '#F8FAFC', borderRadius: '8px', border: '1px solid var(--gray-200)' }}>
          <p style={{ fontWeight: 600, marginBottom: '8px' }}>🎫 Voucher / Kode Undangan</p>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <input
              type="text"
              value={voucherCode}
              onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
              placeholder="Masukkan kode voucher"
              style={{
                flex: 1,
                minWidth: '150px',
                padding: '10px 12px',
                border: '2px solid var(--gray-200)',
                borderRadius: '8px',
                fontSize: '14px',
                fontFamily: 'inherit',
                textTransform: 'uppercase'
              }}
              disabled={!!voucherApplied}
            />
            <button
              onClick={handleApplyVoucher}
              className="btn btn-secondary btn-sm"
              style={{ width: 'auto', minHeight: '40px', padding: '8px 20px' }}
              disabled={!!voucherApplied || applyingVoucher}
            >
              {applyingVoucher ? '⏳...' : 'Apply'}
            </button>
            {voucherApplied && (
              <button
                onClick={() => { setVoucherApplied(null); setVoucherCode('') }}
                className="btn btn-outline btn-sm"
                style={{ width: 'auto', minHeight: '40px', padding: '8px 16px' }}
              >
                ✕ Batal
              </button>
            )}
          </div>
          {voucherError && <p style={{ color: 'var(--danger)', fontSize: '13px', marginTop: '4px' }}>{voucherError}</p>}
          {voucherApplied && (
            <p style={{ color: 'var(--success)', fontSize: '13px', marginTop: '4px' }}>
              ✅ Voucher "{voucherApplied.code}" diterapkan! 
              {voucherApplied.discount_type === 'free' && ' Booking gratis!'}
              {voucherApplied.discount_type === 'percentage' && ` Diskon ${voucherApplied.discount_value}%`}
              {voucherApplied.discount_type === 'fixed' && ` Diskon Rp ${voucherApplied.discount_value.toLocaleString()}`}
            </p>
          )}
        </div>

        <div style={{ background: '#FEF3C7', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px' }}>
          <p style={{ fontSize: '14px', color: '#92400E' }}>
            {voucherApplied ? '✅ Booking dengan voucher! Slot akan langsung aktif.' : '⏰ Slot akan ditahan selama 10 menit untuk menyelesaikan pembayaran.'}
          </p>
        </div>

        <button onClick={handleConfirmBooking} className="btn btn-primary" disabled={loading}>
          {loading ? '⏳ Memproses...' : voucherApplied ? '✅ Booking dengan Voucher' : '✅ Konfirmasi Booking'}
        </button>

        <button onClick={() => navigate('/booking')} className="btn btn-outline" style={{ marginTop: '8px' }}>
          ← Kembali Pilih Slot
        </button>
      </div>
    </div>
  )
}
