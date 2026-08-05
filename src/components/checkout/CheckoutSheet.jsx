// src/components/checkout/CheckoutSheet.jsx

import React, { useState } from 'react'
import { createBooking } from '../../lib/api'
import { calculateDiscount, calculateFinalPrice, formatPrice } from '../../lib/price'
import { validateVoucher } from '../../lib/api'
import { useToast } from '../../hooks/useToast'

function formatTime(date) {
  return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}

export default function CheckoutSheet({
  isOpen,
  onClose,
  range,
  totalPrice,
  selectedDate,
  user,
  voucher,
  onVoucherChange,
  onPayment,
  onBookingCreated,
}) {
  const [voucherCode, setVoucherCode] = useState('')
  const [voucherError, setVoucherError] = useState('')
  const [applying, setApplying] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showVoucher, setShowVoucher] = useState(false)
  const { showToast } = useToast()

  if (!isOpen || !range) return null

  const { start, end, duration } = range
  const finalPrice = voucher ? calculateFinalPrice(totalPrice, voucher) : totalPrice
  const discountAmount = voucher ? calculateDiscount(totalPrice, voucher) : 0

  const handleApplyVoucher = async () => {
    if (!voucherCode.trim()) {
      setVoucherError('Masukkan kode voucher')
      return
    }

    setApplying(true)
    setVoucherError('')

    const { data, error } = await validateVoucher(voucherCode, duration)

    if (error || !data) {
      setVoucherError(error?.message || 'Kode voucher tidak valid')
      setApplying(false)
      return
    }

    onVoucherChange(data)
    showToast(`✅ Voucher "${data.code}" diterapkan!`, 'success')
    setApplying(false)
  }

  const handleConfirmBooking = async () => {
    setLoading(true)

    const dateStr = selectedDate.toISOString().split('T')[0]
    const result = await createBooking(
      user.id,
      { date: dateStr, hour: start.getHours() },
      duration,
      voucher?.id || null
    )

    if (result.error) {
      showToast('❌ ' + result.error.message, 'error')
      setLoading(false)
      return
    }

    onBookingCreated(result.data)
    onPayment()
    setLoading(false)
  }

  return (
    <>
      <div className={`overlay ${isOpen ? 'show' : ''}`} onClick={onClose}></div>
      <div className={`sheet ${isOpen ? 'show' : ''}`}>
        <div className="sheet-handle"></div>
        <div className="sheet-head">
          <span className="sheet-title">Ringkasan pesanan</span>
          <button className="sheet-close" onClick={onClose}>✕</button>
        </div>
        <div className="steps">
          <b>1 · Booking</b>
          <span className="bar active"></span>
          <span>2 · Bayar</span>
          <span className="bar"></span>
        </div>
        <div className="sheet-pad">
          <div className="summary">
            <div className="row">
              <span className="k">📅 Tanggal</span>
              <span className="v">{selectedDate.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
            </div>
            <div className="row">
              <span className="k">⏰ Waktu</span>
              <span className="v">{formatTime(start)} - {formatTime(end)}</span>
            </div>
            <div className="row">
              <span className="k">⏱️ Durasi</span>
              <span className="v">{duration} Jam</span>
            </div>
            <div className="row">
              <span className="k">💰 Total</span>
              <span className="total-v">
                {discountAmount > 0 ? (
                  <>
                    <span className="strike">{formatPrice(totalPrice)}</span>
                    {formatPrice(finalPrice)}
                  </>
                ) : (
                  formatPrice(finalPrice)
                )}
              </span>
            </div>
            {discountAmount > 0 && (
              <div className="row" style={{ marginTop: '4px', borderTop: '1px solid var(--gray-200)' }}>
                <span className="k">🎫 Diskon</span>
                <span className="v" style={{ color: 'var(--success)' }}>- {formatPrice(discountAmount)}</span>
              </div>
            )}
          </div>

          <button className="voucher-toggle" onClick={() => setShowVoucher(!showVoucher)}>
            🎫 Punya kode voucher? <span className="chev">{showVoucher ? '▲' : '▼'}</span>
          </button>
          {showVoucher && (
            <div className="voucher-body show">
              <div className="voucher-row">
                <input
                  className="voucher-input"
                  placeholder="Masukkan kode"
                  value={voucherCode}
                  onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                />
                <button className="btn btn-secondary btn-sm" onClick={handleApplyVoucher} disabled={applying}>
                  {applying ? '⏳' : 'Pakai'}
                </button>
              </div>
              {voucherError && <div className="voucher-msg err">{voucherError}</div>}
              {voucher && <div className="voucher-msg ok">✅ Voucher "{voucher.code}" diterapkan!</div>}
            </div>
          )}

          <div className="note">ℹ️ Booking aktif setelah admin mengonfirmasi pembayaran. PIN akses dikirim otomatis.</div>
          <button className="btn btn-primary" onClick={handleConfirmBooking} disabled={loading}>
            {loading ? '⏳ Memproses...' : 'Lanjut ke pembayaran →'}
          </button>
        </div>
      </div>
    </>
  )
}
