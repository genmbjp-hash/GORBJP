import React from 'react'
import { formatPrice } from '../../lib/price'
import { useToast } from '../../hooks/useToast'

export default function PaymentSheet({ isOpen, onClose, onCancelBooking, booking, user }) {
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

    // Start with header
    let message = `Halo Admin GOR BJP,
Saya sudah melakukan pembayaran untuk booking berikut:

📅 *Tanggal:* ${formatDate(booking.start_time)}
⏰ *Waktu:* ${formatTime(booking.start_time)} - ${formatTime(booking.end_time)}
⏱️ *Durasi:* ${booking.duration_hours} jam
👤 *Customer:* ${customerInfo}

🏷️ *Biaya Sewa:* ${formatPrice(booking.original_price)}`

    // Add donation if exists
    if (booking.donation_amount > 0) {
      message += `\n🙏 *Donasi:* ${formatPrice(booking.donation_amount)}`
    }

    // Separator and total
    message += `\n────────────────────
💰 *Total:* ${formatPrice(booking.price)}

Bukti pembayaran saya lampirkan di bawah ini, mohon segera dikonfirmasi.

Terima kasih. 🙏`

    return encodeURIComponent(message)
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
