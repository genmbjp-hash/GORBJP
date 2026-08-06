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
  const [addDonation, setAddDonation] = useState(false)
  const [donationAmount, setDonationAmount] = useState('')
  const { showToast } = useToast()

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
  const donationInt = parseInt(donationAmount) || 0
  const totalWithDonation = addDonation ? finalPrice + donationInt : finalPrice

  // Resume mode: use existing data
  const isReadOnly = isResuming && existingBooking
  const displayDonation = isResuming && existingBooking?.donation_amount > 0
    ? existingBooking.donation_amount
    : donationInt
  const displayTotal = isResuming && existingBooking
    ? existingBooking.price
    : totalWithDonation
  const displayDiscount = isResuming && existingBooking?.discount_applied > 0
    ? existingBooking.discount_applied
    : discountAmount

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
        setLoading(false)
        return
      }

      if (!(start instanceof Date) || isNaN(start)) {
        throw new Error("Waktu mulai (start time) tidak valid.")
      }

      const dateStr = getLocalDateString(selectedDate)
      const result = await createBooking(
        user.id,
        { date: dateStr, hour: start.getHours() },
        duration,
        voucher?.id || null,
        addDonation ? donationInt : 0
      )

      if (!result || result.error) {
        const errorMsg = result?.error?.message || 'Gagal membuat booking'
        showToast('❌ ' + errorMsg, 'error')
        setLoading(false)
        return
      }

      if (onBookingCreated) await onBookingCreated(result.data)

      // ✅ Open Payment Sheet instead of redirecting immediately
      if (onPayment) await onPayment()
      setLoading(false)

    } catch (error) {
      console.error("Booking checkout error:", error)
      showToast('❌ Terjadi kesalahan: ' + (error.message || 'Sistem error'), 'error')
      setLoading(false)
    } finally {
      setLoading(false)
    }
  }

  const displayDate = isResuming && existingBooking
    ? new Date(existingBooking.start_time)
    : selectedDate

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
          {/* ===== SUMMARY ===== */}
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

            {/* Total */}
            <div className="row" style={{ borderTop: '2px solid var(--primary)', paddingTop: '8px', marginTop: '4px' }}>
              <span className="k" style={{ fontWeight: 700 }}>💰 Total</span>
              <span className="total-v">{formatPrice(displayTotal)}</span>
            </div>

            {/* Discount */}
            {displayDiscount > 0 && (
              <div className="row" style={{ borderBottom: 'none', paddingTop: '4px' }}>
                <span className="k" style={{ fontSize: '13px', color: 'var(--gray-500)' }}>🎫 Diskon</span>
                <span className="v" style={{ color: 'var(--success)', fontSize: '14px' }}>- {formatPrice(displayDiscount)}</span>
              </div>
            )}
          </div>

          {/* ===== RESUME MODE: READ-ONLY ===== */}
          {isReadOnly ? (
            <>
              {existingBooking.voucher_id && (
                <div style={{
                  background: '#F0FDF4',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid #86EFAC',
                  marginTop: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <span style={{ fontSize: '14px', color: '#065F46' }}>
                    🎫 Voucher
                  </span>
                  <span className="badge badge-active" style={{ fontWeight: 600 }}>
                    ✅ Aktif
                  </span>
                </div>
              )}

              {existingBooking.donation_amount > 0 && (
                <div style={{
                  background: '#F3E8FF',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid #D8B4FE',
                  marginTop: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <span style={{ fontSize: '14px', color: '#6B21A8' }}>
                    🙏 Donasi
                  </span>
                  <span style={{ fontWeight: 600, color: '#6B21A8' }}>
                    {formatPrice(existingBooking.donation_amount)}
                  </span>
                </div>
              )}

              <div style={{
                marginTop: '12px',
                padding: '10px 14px',
                background: '#EFF6FF',
                borderRadius: '8px',
                border: '1px solid #93C5FD',
                fontSize: '13px',
                color: '#1E40AF',
                textAlign: 'center'
              }}>
                ℹ️ Voucher diskon dan/atau donasi tidak dapat diubah.
                Silahkan batalkan pesanan ini dan buat pesanan baru jika ingin melakukan perubahan.
              </div>
            </>
          ) : (
            <>
              {/* ===== VOUCHER ===== */}
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

              {/* ===== DONATION ===== */}
              <div style={{ marginTop: '16px' }}>
                <div className="row" style={{ borderBottom: 'none', padding: '8px 0' }}>
                  <span className="k" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="checkbox"
                      checked={addDonation}
                      onChange={(e) => handleDonationToggle(e.target.checked)}
                      style={{ width: '18px', height: '18px', accentColor: '#8B5CF6', cursor: 'pointer' }}
                    />
                    🙏 Tambahkan donasi (opsional)
                  </span>
                </div>

                {addDonation && (
                  <div className="row" style={{ borderBottom: 'none', paddingTop: '0' }}>
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
              </div>
            </>
          )}

          {/* ===== NOTE ===== */}
          <div className="note" style={{ marginTop: '16px', fontSize: '0.9em', color: 'var(--gray-600)' }}>
            {isResuming
              ? 'ℹ️ Lanjutkan pembayaran untuk booking yang sudah dibuat.'
              : 'ℹ️ Booking aktif setelah admin mengonfirmasi pembayaran. PIN akses dikirim otomatis.'}
          </div>

          {/* ===== BUTTON ===== */}
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
