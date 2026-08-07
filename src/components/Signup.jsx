import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { signUp } from '../lib/supabase'
import { useToast } from '../contexts/ToastContext'

export default function Signup() {
  const [fullName, setFullName] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [block, setBlock] = useState('')
  const [houseNumber, setHouseNumber] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const { showToast } = useToast()

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)

    if (password.length < 6) {
      showToast('❌ Kata sandi minimal 6 karakter', 'error')
      setLoading(false)
      return
    }

    if (!block) {
      showToast('❌ Silakan pilih Blok', 'error')
      setLoading(false)
      return
    }

    if (!houseNumber.trim()) {
      showToast('❌ Nomor Rumah wajib diisi', 'error')
      setLoading(false)
      return
    }

    const { data, error } = await signUp(
      email,
      password,
      fullName,
      displayName,
      phone,
      block,
      houseNumber
    )

    if (error) {
      showToast('❌ ' + error.message, 'error')
      setLoading(false)
      return
    }

    setSuccess(true)
    showToast('✅ Pendaftaran berhasil! Menunggu persetujuan admin.', 'success')
    setLoading(false)
  }

  if (success) {
    return (
      <div className="container" style={{ paddingTop: '40px' }}>
        <div className="card" style={{ border: '2px solid var(--success)' }}>
          <div className="text-center">
            <h2 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--success)' }}>✅ Pendaftaran Berhasil!</h2>
            <p style={{ color: 'var(--gray-500)', marginTop: '8px' }}>Akun Anda sedang menunggu persetujuan admin.</p>
            <p style={{ fontSize: '14px', color: 'var(--gray-400)' }}>Anda akan dapat memesan setelah disetujui.</p>
            <Link to="/login" className="btn btn-primary" style={{ marginTop: '16px' }}>🔐 Kembali ke Masuk</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container" style={{ paddingTop: '40px' }}>
      <div className="card">
        <div className="text-center" style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 700 }}>📝 Daftar</h2>
          <p style={{ color: 'var(--gray-500)', fontSize: '14px' }}>Buat akun untuk mulai memesan</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="fullName">
              Nama Lengkap (untuk verifikasi) *
            </label>
            <input
              type="text"
              id="fullName"
              className="form-input"
              placeholder="Nama sesuai KTP"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
            <p style={{ fontSize: '11px', color: 'var(--gray-400)', marginTop: '4px' }}>
              Nama lengkap hanya terlihat oleh admin
            </p>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="displayName">
              Nama Panggilan (muncul di app) *
            </label>
            <input
              type="text"
              id="displayName"
              className="form-input"
              placeholder="Nama yang ingin ditampilkan"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
            <p style={{ fontSize: '11px', color: 'var(--gray-400)', marginTop: '4px' }}>
              Nama ini akan muncul di dashboard dan pesanan
            </p>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="email">Email *</label>
            <input
              type="email"
              id="email"
              className="form-input"
              placeholder="email@anda.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="phone">Nomor HP *</label>
            <input
              type="tel"
              id="phone"
              className="form-input"
              placeholder="0812-3456-7890"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="block">Blok Rumah *</label>
            <select
              id="block"
              className="form-input"
              value={block}
              onChange={(e) => setBlock(e.target.value)}
              required
            >
              <option value="">Pilih Blok</option>
              <option value="A">Blok A</option>
              <option value="C">Blok C</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="houseNumber">Nomor Rumah *</label>
            <input
              type="text"
              id="houseNumber"
              className="form-input"
              placeholder="Contoh: 12A, 15, 07"
              value={houseNumber}
              onChange={(e) => setHouseNumber(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Kata Sandi *</label>
            <input
              type="password"
              id="password"
              className="form-input"
              placeholder="Minimal 6 karakter"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength="6"
            />
            <p style={{ fontSize: '12px', color: 'var(--gray-400)', marginTop: '4px' }}>
              Minimal 6 karakter
            </p>
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? '⏳ Memproses...' : 'Daftar'}
          </button>

          <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '14px', color: 'var(--gray-500)' }}>
            Sudah punya akun? <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>Masuk</Link>
          </div>
        </form>
      </div>
    </div>
  )
}
