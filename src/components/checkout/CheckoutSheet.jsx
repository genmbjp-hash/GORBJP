import React, { useState, useEffect } from 'react'
import { createBooking, validateVoucher } from '../../lib/api'
import { calculateDiscount, calculateFinalPrice, formatPrice } from '../../lib/price'
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
  // ✅ Donation states
  const [addDonation, setAddDonation] = useState(false)
  const [donationAmount, setDonationAmount] = useState('')
  const { showToast } = useToast()

  // Clear errors when hiding the voucher input
  useEffect(() => {
    if (!showVoucher) {
      setVoucherError('')
    }
  }, [showVoucher])

  if (!isOpen) return null

  const start = isResuming && existingBooking ? new Date(existingBooking.start_time) : range?.start
  const end = isResuming && existingBooking ? new Date(existingBooking.end_time) : range?.end
  const duration = isResuming && existingBooking ? existingBooking.duration_hours : range?.duration
  const price = isResuming && existingBooking ? existingBooking.price : totalPrice

  if (!start || !end || !duration) return null

  const finalPrice = voucher ? calculateFinalPrice(price, voucher) : price
  const discountAmount = voucher ? calculateDiscount(price, voucher) : 0
  // ✅ Calculate donation and total
  const donationInt = parseInt(donationAmount) || 0
  const totalWithDonation = addDonation ? finalPrice + donationInt : finalPrice

  const handleApplyVoucher = async () => {
    if (!voucherCode.trim()) {
      setVoucherError('Masukkan kode voucher')
      return
    }

    setApplying(true)
    setVoucherError('')

    try {
      const { data, error } = await validateVoucher(voucherCode, duration)

      if (error || !data) {
        setVoucherError(error?.message || 'Kode voucher tidak valid')
        return
      }

      onVoucherChange(data)
      showToast(`✅ Voucher "${data.code}" diterapkan!`, 'success')
    } catch (err) {
      setVoucherError('Terjadi kesalahan saat mengecek voucher')
    } finally {
      setApplying(false)
    }
  }

  const handleRemoveVoucher = () => {
    onVoucherChange(null)
    setVoucherCode('')
    setVoucherError('')
    showToast('Voucher dihapus', 'info')
  }

  const handleConfirmBooking = async () => {
    setLoading(true)

    try {
      // If resuming existing booking, just go to payment
      if (isResuming && existingBooking) {
        if (onPayment) await onPayment()
        return
      }

      // Ensure 'start' is a valid Date before trying to call getHours()
      if (!(start instanceof Date) || isNaN(start)) {
        throw new Error("Waktu mulai (start time) tidak valid.")
      }

      const dateStr = getLocalDateString(selectedDate)
      // ✅ Pass donation amount to createBooking
      const result = await createBooking(
        user.id,
        { date: dateStr, hour: start.getHours() },
        duration,
        voucher?.id || null,
        addDonation ? donationInt : 0  // ✅ Donation amount
      )

      if (!result || result.error) {
        const errorMsg = result?.error?.message || 'Gagal membuat booking'
        showToast('❌ ' + errorMsg, 'error')
        return
      }

      if (onBookingCreated) await onBookingCreated(result.data)
      if (onPayment) await onPayment()

    } catch (error) {
      console.error("Booking checkout error:", error)
      showToast('❌ Terjadi kesalahan: ' + (error.message || 'Sistem error'), 'error')
    } finally {
      // This guarantees the button will stop loading, even if the code above crashes
      setLoading(false)
    }
  }

  const displayDate = isResuming && existingBooking
    ? new Date(existingBooking.start_time)
    : selectedDate

  // ✅ Handle donation toggle
  const handleDonationToggle = (checked) => {
    setAddDonation(checked)
    if (!checked) {
      setDonationAmount('')
    }
  }

  return (
    <>
      <div className={`overlay ${isOpen ? 'show' : ''}`} onClick={onClose}></div>
      <div className={`sheet ${isOpen ? 'show' : ''}`}>
        <div className="sheet-handle"></div>
        <div className="sheet-head">
          <span className="sheet-title">
            {isResuming ? 'Lanjutkan Pembayaran' : 'Ringkasan Pesanan'}
          </span>
          <button className="sheet-close" onClick={onClose} disabled={loading}>✕</button>
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
                    <span className="strike" style={{ textDecoration: 'line-through', marginRight: '8px', color: 'var(--gray-500)' }}>
                      {formatPrice(price)}
                    </span>
                    {formatPrice(finalPrice)}
                  </>
                ) : (
                  formatPrice(finalPrice)
                )}
              </span>
            </div>
            {discountAmount > 0 && (
              <div className="row" style={{ marginTop: '4px', borderTop: '1px solid var(--gray-200)', paddingTop: '8px' }}>
                <span className="k">🎫 Diskon</span>
                <span className="v" style={{ color: 'var(--success)' }}>- {formatPrice(discountAmount)}</span>
              </div>
            )}

            {/* ✅ Donation Toggle */}
            <div className="row" style={{ borderBottom: 'none', paddingTop: '8px' }}>
              <span className="k" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  checked={addDonation}
                  onChange={(e) => handleDonationToggle(e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: '#8B5CF6', cursor: 'pointer' }}
                />
                🙏 Tambahkan donasi (opsional)
              </span>
              {addDonation && (
                <span className="v" style={{ color: '#8B5CF6' }}>
                  + {donationInt > 0 ? formatPrice(donationInt) : 'Rp 0'}
                </span>
              )}
            </div>

            {/* ✅ Donation Input (visible when checkbox is checked) */}
            {addDonation && (
              <div className="row" style={{ borderBottom: 'none', paddingTop: '4px' }}>
                <span className="k" style={{ fontSize: '13px', color: 'var(--gray-500)' }}>
                  Masukkan nominal
                </span>
                <input
                  type="number"
                  className="form-input"
                  placeholder="Contoh: 25000"
                  value={donationAmount}
                  onChange={(e) => setDonationAmount(e.target.value)}
                  min="1"
                  style={{ 
                    padding: '6px 12px', 
                    fontSize: '14px', 
                    width: '150px', 
                    textAlign: 'right',
                    border: '1px solid var(--gray-300)',
                    borderRadius: '6px'
                  }}
                  autoFocus={addDonation}
                />
              </div>
            )}

            {/* ✅ Total with Donation */}
            <div className="row" style={{ borderTop: '2px solid var(--primary)', paddingTop: '8px', marginTop: '8px' }}>
              <span className="k" style={{ fontWeight: 700 }}>Total</span>
              <span className="total-v">{formatPrice(totalWithDonation)}</span>
            </div>
          </div>

          {!isResuming && (
            <>
              <button className="voucher-toggle" onClick={() => setShowVoucher(!showVoucher)}>
                🎫 Punya kode voucher? <span className="chev">{showVoucher ? '▲' : '▼'}</span>
              </button>
              
              {showVoucher && (
                <div className="voucher-body show">
                  <div className="voucher-row" style={{ display: 'flex', gap: '8px' }}>
                    <input
                      className="voucher-input"
                      placeholder="Masukkan kode"
                      value={voucherCode}
                      onChange={(e) => setVoucherCode(e.target.value.toUpperCase())}
                      disabled={applying || !!voucher}
                      style={{ flex: 1 }}
                    />
                    
                    {voucher ? (
                      <button className="btn btn-secondary btn-sm" onClick={handleRemoveVoucher} disabled={applying}>
                        Hapus
                      </button>
                    ) : (
                      <button className="btn btn-secondary btn-sm" onClick={handleApplyVoucher} disabled={applying}>
                        {applying ? '⏳' : 'Pakai'}
                      </button>
                    )}
                  </div>
                  {voucherError && <div className="voucher-msg err" style={{ color: 'red', marginTop: '4px' }}>{voucherError}</div>}
                  {voucher && <div className="voucher-msg ok" style={{ color: 'green', marginTop: '4px' }}>✅ Voucher "{voucher.code}" diterapkan!</div>}
                </div>
              )}
            </>
          )}

          <div className="note" style={{ marginTop: '16px', fontSize: '0.9em', color: 'var(--gray-600)' }}>
            {isResuming
              ? 'ℹ️ Lanjutkan pembayaran untuk booking yang sudah dibuat.'
              : 'ℹ️ Booking aktif setelah admin mengonfirmasi pembayaran. PIN akses dikirim otomatis.'}
          </div>
          
          <button 
            className="btn btn-primary" 
            onClick={handleConfirmBooking} 
            disabled={loading}
            style={{ width: '100%', marginTop: '16px' }}
          >
            {loading ? '⏳ Memproses...' : isResuming ? '💳 Lanjutkan Pembayaran →' : 'Lanjut ke pembayaran →'}
          </button>
        </div>
      </div>
    </>
  )
}
