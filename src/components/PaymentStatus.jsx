import React, { useEffect, useState, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

// How long to keep polling the database for the webhook to catch up
// before giving up and showing "still processing" instead of a false
// negative. Midtrans redirects the browser back almost instantly, but
// the webhook is a separate, async server-to-server call that can lag a
// few seconds behind — so a single DB check right on page load would
// often show "pending" for a payment that actually already succeeded.
const POLL_INTERVAL_MS = 2000
const MAX_POLL_ATTEMPTS = 8 // ~16 seconds total

export default function PaymentStatus() {
  const location = useLocation()
  const navigate = useNavigate()
  const [status, setStatus] = useState('loading')
  const [checking, setChecking] = useState(false)
  const pollCountRef = useRef(0)
  const timeoutRef = useRef(null)
  const ourOrderIdRef = useRef(null)

  async function fetchBookingStatus(ourOrderId) {
    const { data: booking, error } = await supabase
      .from('bookings')
      .select('status, payment_status')
      .eq('midtrans_order_id', ourOrderId)
      .maybeSingle()

    if (error || !booking) return { result: 'unknown' }
    if (booking.status === 'active' && booking.payment_status === 'paid') return { result: 'success' }
    if (booking.status === 'cancelled' || booking.payment_status === 'failed') return { result: 'failed' }
    return { result: 'pending' }
  }

  const handleManualRetry = async () => {
    if (!ourOrderIdRef.current || checking) return
    setChecking(true)
    const { result } = await fetchBookingStatus(ourOrderIdRef.current)
    setChecking(false)

    if (result === 'success') {
      setStatus('success')
      timeoutRef.current = setTimeout(() => navigate('/dashboard'), 4000)
    } else if (result === 'failed') {
      setStatus('failed')
    } else if (result === 'unknown') {
      setStatus('unknown')
    }
    // still 'pending' → stay on the pending screen, nothing to change
  }

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const orderId = params.get('order_id')

    if (!orderId) {
      // No order_id at all means this page was reached in an unexpected
      // way (not an actual Midtrans redirect) — don't guess, just point
      // the person at their Dashboard, which is always the source of truth.
      setStatus('unknown')
      return
    }

    // Reconstruct OUR order_id the same way the webhook does. We only
    // ever generate order_id as "{8 hex chars}-{timestamp}" (exactly two
    // dash-separated segments) — Midtrans appends its own suffix on top
    // (e.g. "...-1786013989503"), so take just the first two segments
    // regardless of what's appended after.
    const ourOrderId = orderId.split('-').slice(0, 2).join('-')
    ourOrderIdRef.current = ourOrderId

    let cancelled = false

    async function poll() {
      const { result } = await fetchBookingStatus(ourOrderId)
      if (cancelled) return

      if (result === 'success') {
        setStatus('success')
        timeoutRef.current = setTimeout(() => navigate('/dashboard'), 4000)
        return
      }

      if (result === 'failed' || result === 'unknown') {
        setStatus(result)
        return
      }

      // Still pending — the webhook may just not have arrived/processed
      // yet. Keep polling for a while before settling on "still pending".
      pollCountRef.current += 1
      if (pollCountRef.current < MAX_POLL_ATTEMPTS) {
        timeoutRef.current = setTimeout(poll, POLL_INTERVAL_MS)
      } else {
        setStatus('pending')
      }
    }

    poll()

    return () => {
      cancelled = true
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [location, navigate])

  if (status === 'loading') {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        padding: '20px'
      }}>
        <div className="spinner" style={{ marginBottom: '16px' }}></div>
        <p style={{ color: 'var(--gray-500)' }}>Memeriksa status pembayaran...</p>
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '20px',
      textAlign: 'center'
    }}>
      <div className="card" style={{ maxWidth: '400px', width: '100%' }}>
        {status === 'success' && (
          <>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>✅</div>
            <h2 style={{ color: 'var(--success)', marginBottom: '8px' }}>Pembayaran Berhasil!</h2>
            <p style={{ color: 'var(--gray-600)' }}>PIN akses Anda sudah tersedia di Dashboard.</p>
            <p style={{ fontSize: '13px', color: 'var(--gray-400)', marginTop: '4px' }}>
              Mengalihkan ke Dashboard dalam beberapa detik...
            </p>
            <button
              onClick={() => navigate('/dashboard')}
              className="btn btn-primary"
              style={{ marginTop: '16px' }}
            >
              Ke Dashboard
            </button>
          </>
        )}

        {status === 'pending' && (
          <>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>⏳</div>
            <h2 style={{ color: 'var(--warning)', marginBottom: '8px' }}>Memproses Pembayaran</h2>
            <p style={{ color: 'var(--gray-600)' }}>
              Pembayaran Anda sedang diverifikasi. Ini biasanya hanya butuh beberapa detik.
            </p>
            <p style={{ fontSize: '13px', color: 'var(--gray-400)', marginTop: '4px' }}>
              Belum selesai bayar? Cek Dashboard untuk melanjutkan.
            </p>
            <div style={{ display: 'flex', gap: '8px', marginTop: '16px', justifyContent: 'center' }}>
              <button
                onClick={handleManualRetry}
                className="btn btn-primary"
                disabled={checking}
              >
                {checking ? '⏳ Mengecek...' : '🔄 Cek Lagi'}
              </button>
              <button
                onClick={() => navigate('/dashboard')}
                className="btn btn-outline"
              >
                Ke Dashboard
              </button>
            </div>
          </>
        )}

        {status === 'failed' && (
          <>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>❌</div>
            <h2 style={{ color: 'var(--danger)', marginBottom: '8px' }}>Pembayaran Gagal</h2>
            <p style={{ color: 'var(--gray-600)' }}>Pembayaran Anda tidak berhasil atau dibatalkan.</p>
            <p style={{ fontSize: '13px', color: 'var(--gray-400)', marginTop: '4px' }}>
              Silakan coba lagi atau hubungi admin.
            </p>
            <div style={{ display: 'flex', gap: '8px', marginTop: '16px', justifyContent: 'center' }}>
              <button
                onClick={() => navigate('/booking')}
                className="btn btn-primary"
              >
                Booking Ulang
              </button>
              <button
                onClick={() => navigate('/dashboard')}
                className="btn btn-outline"
              >
                Ke Dashboard
              </button>
            </div>
          </>
        )}

        {status === 'unknown' && (
          <>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>ℹ️</div>
            <h2 style={{ color: 'var(--gray-700)', marginBottom: '8px' }}>Status Belum Diketahui</h2>
            <p style={{ color: 'var(--gray-600)' }}>
              Kami tidak bisa memastikan status pembayaran dari halaman ini.
            </p>
            <p style={{ fontSize: '13px', color: 'var(--gray-400)', marginTop: '4px' }}>
              Cek Dashboard untuk melihat status booking Anda yang sebenarnya.
            </p>
            <button
              onClick={() => navigate('/dashboard')}
              className="btn btn-primary"
              style={{ marginTop: '16px' }}
            >
              Ke Dashboard
            </button>
          </>
        )}
      </div>
    </div>
  )
}
