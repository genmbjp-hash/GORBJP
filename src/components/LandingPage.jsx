// src/components/LandingPage.jsx
import React from 'react'

export default function LandingPage({ user, profile }) {
  return (
    <div className="container" style={{ paddingTop: '40px' }}>
      <div className="card" style={{ background: 'linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%)', color: 'white', border: 'none', textAlign: 'center', padding: '40px 24px' }}>
        <h1 style={{ fontSize: '40px', fontWeight: 800, marginBottom: '8px' }}>🏛️ Gedung Serbaguna BJP</h1>
      </div>

      <div className="card">
        <h3 style={{ fontSize: '18px', fontWeight: 700, textAlign: 'center', color: 'var(--primary)', marginBottom: '16px' }}>📋 Cara Kerja</h3>
        <div className="how-it-works">
          <div className="hiw-step">
            <div className="hiw-number">1</div>
            <div className="hiw-text">Daftar & Tunggu Approval</div>
          </div>
          <div className="hiw-step">
            <div className="hiw-number">2</div>
            <div className="hiw-text">Pilih Tanggal & Waktu</div>
          </div>
          <div className="hiw-step">
            <div className="hiw-number">3</div>
            <div className="hiw-text">Dapatkan PIN Booking</div>
          </div>
        </div>
      </div>

      {user && profile?.status === 'pending' && (
        <div className="alert alert-warning">
          ⏳ Akun Anda menunggu persetujuan admin. Silakan tunggu.
        </div>
      )}

      {user && profile?.status === 'rejected' && (
        <div className="alert alert-error">
          ❌ Akun Anda ditolak. Hubungi admin.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
        <a href="/login" className="btn btn-primary">🔐 Masuk</a>
        <a href="/signup" className="btn btn-secondary">📝 Daftar</a>
      </div>

      <div style={{ textAlign: 'center', padding: '24px 0 16px', fontSize: '12px', color: 'var(--gray-400)' }}>
        © 2026 Gen M BJP
      </div>
    </div>
  )
}
