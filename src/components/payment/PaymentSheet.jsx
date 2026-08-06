import React, { useState } from 'react'
import { formatPrice } from '../../lib/price'
import { createPaymentLink } from '../../lib/api'
import { useToast } from '../../hooks/useToast'

export default function PaymentSheet({ isOpen, onClose, onCancelBooking, booking, user }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showFallback, setShowFallback] = useState(false)
  const { showToast } = useToast()

  if (!isOpen || !booking) return null

  const ADMIN_PHONE = '628112012610'
  const WHATSAPP_LINK = `https://wa.me/${ADMIN_PHONE}`

  function formatTime(date) {
    return new Date(date).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
  }

  function formatDate(date) {
    return new Date(date).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  }

  function getWhatsAppMessage() {
    const customerName = user?.display_name || user?.full_name || 'Customer'
    const block = user?.block ? `Blok ${user.block}` : ''
    const houseNumber = user?.house_number ? `No. ${user.house_number}` : ''
    const customerInfo = `${customerName} ${block} ${houseNumber}`.trim()

    let message = `Halo Admin GOR BJP,
Saya sudah melakukan pembayaran untuk booking berikut:

📅 *Tanggal:* ${formatDate(booking.start_time)}
⏰ *Waktu:* ${formatTime(booking.start_time)} - ${formatTime(booking.end_time)}
⏱️ *Durasi:* ${booking.duration_hours} jam
👤 *Customer:* ${customerInfo}

🏷️ *Biaya Sewa:* ${formatPrice(booking.original_price)}`

    if (booking.donation_amount > 0) {
      message += `\n🙏 *Donasi:* ${formatPrice(booking.donation_amount)}`
    }

    message += `\n────────────────────
💰 *Total:* ${formatPrice(booking.price)}

Bukti pembayaran saya lampirkan di bawah ini, mohon segera dikonfirmasi.

Terima kasih. 🙏`

    return encodeURIComponent(message)
  }

  const handlePayWithMidtrans = async () => {
    setLoading(true)
    setError(null)

    try {
      const result = await createPaymentLink(
        booking.id,
        booking.price,
        {
          display_name: user?.display_name,
          full_name: user?.full_name,
          email: user?.email,
          phone: user?.phone
        },
        booking.donation_amount || 0
      )

      if (result.success) {
        window.location.href = result.payment_url
        return
      }

      setError(result.error || 'Gagal membuat link pembayaran')
      setShowFallback(true)
      showToast('⚠️ Midtrans error, gunakan QRIS manual', 'warning')
      
    } catch (error) {
      setError(error.message)
      setShowFallback(true)
      showToast('⚠️ Terjadi kesalahan, gunakan QRIS manual', 'warning')
    } finally {
      setLoading(false)
    }
  }

  const handleCancelFallback = () => {
    setShowFallback(false)
    setError(null)
  }

  return (
    <>
      <div className={`overlay ${isOpen ? 'show' : ''}`} onClick={onClose}></div>
      <div className={`sheet ${isOpen ? 'show' : ''}`}>
        <div className="sheet-handle"></div>
        <div className="sheet-head">
          <span className="sheet-title">Pembayaran</span>
          <button className="sheet-close" onClick={onClose}>✕</button>
        </div>
        <div className="steps">
          <span>1 · Booking</span>
          <span className="bar active"></span>
          <b>2 · Bayar</b>
          <span className="bar active"></span>
        </div>
        <div className="sheet-pad">

          {!showFallback ? (
            <>
              <div className="qris" style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '14px', fontWeight: 600, color: '#065F46', marginBottom: '4px' }}>
                  💳 Bayar via QRIS (Otomatis)
                </p>
                <p style={{ fontSize: '32px', marginBottom: '8px' }}>🔴</p>
                <small>Total: <strong>{formatPrice(booking.price)}</strong></small>
                {booking.donation_amount > 0 && (
                  <small style={{ display: 'block', color: '#8B5CF6', marginTop: '4px' }}>
                    🙏 Termasuk donasi {formatPrice(booking.donation_amount)}
                  </small>
                )}
                <div style={{ marginTop: '16px' }}>
                  <button
                    className="btn btn-primary"
                    onClick={handlePayWithMidtrans}
                    disabled={loading}
                  >
                    {loading ? '⏳ Memproses...' : '🔴 Bayar via QRIS'}
                  </button>
                </div>
                <p style={{ fontSize: '12px', color: 'var(--gray-400)', marginTop: '12px' }}>
                  Anda akan diarahkan ke halaman pembayaran Midtrans.
                  <br />Pembayaran otomatis dikonfirmasi.
                </p>
              </div>

              {error && (
                <div style={{ background: '#FEE2E2', padding: '12px', borderRadius: '8px', border: '1px solid #FCA5A5', marginBottom: '12px' }}>
                  <p style={{ fontSize: '14px', color: '#991B1B' }}>
                    ❌ {error}
                  </p>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setShowFallback(true)}
                    style={{ marginTop: '8px', width: 'auto' }}
                  >
                    Gunakan QRIS Manual
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              <div style={{ background: '#FEF3C7', padding: '12px', borderRadius: '8px', border: '1px solid #F59E0B', marginBottom: '12px' }}>
                <p style={{ fontSize: '14px', color: '#92400E', fontWeight: 600 }}>
                  ⚠️ Mode Manual (Fallback)
                </p>
                <p style={{ fontSize: '12px', color: '#92400E' }}>
                  Midtrans tidak tersedia saat ini. Gunakan QRIS manual di bawah ini.
                </p>
              </div>

              <div className="qris">
                <p style={{ fontSize: '14px', fontWeight: 600, color: '#065F46', marginBottom: '4px' }}>
                  Scan QRIS untuk membayar
                </p>
                <img 
                  src="/qris.png" 
                  alt="QRIS" 
                  style={{ 
                    maxWidth: '180px', 
                    width: '100%', 
                    height: 'auto',
                    margin: '0 auto',
                    display: 'block',
                    borderRadius: '8px',
                    border: '6px solid #fff',
                    boxShadow: '0 0 0 1px #86EFAC'
                  }} 
                />
                <small>Total: <strong>{formatPrice(booking.price)}</strong></small>
                {booking.donation_amount > 0 && (
                  <small style={{ display: 'block', color: '#8B5CF6', marginTop: '4px' }}>
                    🙏 Termasuk donasi {formatPrice(booking.donation_amount)}
                  </small>
                )}
              </div>

              <div style={{ background: '#EFF6FF', padding: '16px', borderRadius: '8px', border: '1px solid #93C5FD', marginBottom: '16px' }}>
                <p style={{ fontSize: '14px', color: '#1E40AF', fontWeight: 600, marginBottom: '8px' }}>
                  ✅ Sudah bayar? Konfirmasi ke admin
                </p>
                <a
                  href={`${WHATSAPP_LINK}?text=${getWhatsAppMessage()}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-success"
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px', width: '100%', textDecoration: 'none' }}
                >
                  💬 Konfirmasi via WhatsApp
                </a>
                <p style={{ fontSize: '12px', color: '#1E40AF', marginTop: '8px', textAlign: 'center' }}>
                  Pastikan kamu juga mengirim bukti pembayaran kepada admin.
                </p>
              </div>

              <button
                className="btn btn-outline btn-sm"
                onClick={handleCancelFallback}
                style={{ width: 'auto', marginBottom: '8px' }}
              >
                ↩️ Kembali ke QRIS Otomatis
              </button>
            </>
          )}

          <button className="btn btn-outline" onClick={onCancelBooking || onClose}>
            ❌ Batalkan Pesanan
          </button>
          <p style={{ fontSize: '11px', color: 'var(--gray-400)', textAlign: 'center', marginTop: '8px' }}>
            Sudah scan &amp; mau bayar nanti? Tutup jendela ini saja — pesanan Anda tersimpan dan bisa dilanjutkan dari Dashboard.
          </p>

        </div>
      </div>
    </>
  )
}
