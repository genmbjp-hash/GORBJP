import React, { useState } from 'react'
import { createBooking } from '../../lib/api'
import { calculateDiscount, calculateFinalPrice, formatPrice } from '../../lib/price'
import { validateVoucher } from '../../lib/api'
import { useToast } from '../../hooks/useToast'

function getLocalDateString(date) {
  if (!date) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

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
  isResuming = false,
  existingBooking = null,
}) {
  const [voucherCode, setVoucherCode] = useState('')
  const [voucherError, setVoucherError] = useState('')
  const [applying, setApplying] = useState(false)
  const [loading, setLoading] = useState(false)
  const [showVoucher, setShowVoucher] = useState(false)
  const { showToast } = useToast()

  if (!isOpen) return null

  const start = isResuming && existingBooking ? new Date(existingBooking.start_time) : range?.start
  const end = isResuming && existingBooking ? new Date(existingBooking.end_time) : range?.end
  const duration = isResuming && existingBooking ? existingBooking.duration_hours : range?.duration
  const price = isResuming && existingBooking ? existingBooking.price : totalPrice

  if (!start || !end || !duration) return null

  const finalPrice = voucher ? calculateFinalPrice(price, voucher) : price
  const discountAmount = voucher ? calculateDiscount(price, voucher) : 0

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

    if (isResuming && existingBooking) {
      onPayment()
      setLoading(false)
      return
    }

    try {
      const dateStr = getLocalDateString(selectedDate)
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
    } catch (error) {
      console.error('Booking error:', error)
      showToast('❌ Gagal membuat booking: ' + error.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const displayDate = isResuming && existingBooking
    ? new Date(existingBooking.start_time)
    : selectedDate

  return (
    <>
      <div className={`overlay ${isOpen ? 'show' : ''}`} onClick={onClose}></div>
      <div className={`sheet ${isOpen ? 'show' : ''}`}>
        <div className="sheet-handle"></div>
        <div className="sheet-head">
          <span className="sheet-title">
            {isResuming ? 'Lanjutkan Pembayaran' : 'Ringkasan Pesanan'}
          </span>
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
              <span className="v">
                {displayDate.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </span>
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
                    <span className="strike">{formatPrice(price)}</span>
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

          <div className="note">
            {isResuming
              ? 'ℹ️ Lanjutkan pembayaran untuk booking yang sudah dibuat.'
              : 'ℹ️ Booking aktif setelah admin mengonfirmasi pembayaran. PIN akses dikirim otomatis.'}
          </div>
          <button className="btn btn-primary" onClick={handleConfirmBooking} disabled={loading}>
            {loading ? '⏳ Memproses...' : isResuming ? '💳 Lanjutkan Pembayaran →' : 'Lanjut ke pembayaran →'}
          </button>
        </div>
      </div>
    </>
  )
}
