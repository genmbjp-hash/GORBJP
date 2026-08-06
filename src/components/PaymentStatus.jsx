// src/components/PaymentStatus.jsx

import React, { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

export default function PaymentStatus() {
  const location = useLocation()
  const navigate = useNavigate()
  const [status, setStatus] = useState('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const transactionStatus = params.get('transaction_status')
    const orderId = params.get('order_id')

    console.log('Payment status:', transactionStatus, 'Order:', orderId)

    if (transactionStatus === 'settlement' || transactionStatus === 'capture') {
      setStatus('success')
      setMessage('✅ Pembayaran berhasil! PIN akses akan segera dikirim.')
      setTimeout(() => navigate('/dashboard'), 5000)
    } else if (transactionStatus === 'pending') {
      setStatus('pending')
      setMessage('⏳ Menunggu pembayaran. Selesaikan pembayaran Anda.')
    } else if (transactionStatus === 'deny' || transactionStatus === 'expire' || transactionStatus === 'cancel') {
      setStatus('failed')
      setMessage('❌ Pembayaran gagal atau dibatalkan. Silakan coba lagi.')
    } else {
      setStatus('info')
      setMessage('ℹ️ Status pembayaran belum diketahui. Cek Dashboard untuk informasi lebih lanjut.')
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
        <p style={{ color: 'var(--gray-500)' }}>Memproses pembayaran...</p>
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
            <p style={{ color: 'var(--gray-600)' }}>PIN akses akan segera dikirim via WhatsApp.</p>
            <p style={{ fontSize: '13px', color: 'var(--gray-400)', marginTop: '4px' }}>
              Mengalihkan ke Dashboard dalam 5 detik...
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
            <h2 style={{ color: 'var(--warning)', marginBottom: '8px' }}>Menunggu Pembayaran</h2>
            <p style={{ color: 'var(--gray-600)' }}>Silakan selesaikan pembayaran Anda.</p>
            <p style={{ fontSize: '13px', color: 'var(--gray-400)', marginTop: '4px' }}>
              Jika sudah bayar, tunggu konfirmasi otomatis.
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

        {status === 'failed' && (
          <>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>❌</div>
            <h2 style={{ color: 'var(--danger)', marginBottom: '8px' }}>Pembayaran Gagal</h2>
            <p style={{ color: 'var(--gray-600)' }}>Pembayaran Anda tidak berhasil.</p>
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

        {status === 'info' && (
          <>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>ℹ️</div>
            <h2 style={{ color: 'var(--gray-700)', marginBottom: '8px' }}>Status Pembayaran</h2>
            <p style={{ color: 'var(--gray-600)' }}>{message}</p>
            <p style={{ fontSize: '13px', color: 'var(--gray-400)', marginTop: '4px' }}>
              Cek Dashboard untuk melihat status booking Anda.
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
