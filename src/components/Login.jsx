import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { signIn, getProfile } from '../lib/supabase'
import { useToast } from '../../contexts/ToastContext'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const showToast = useToast()

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)

    const { data, error } = await signIn(email, password)

    if (error) {
      showToast('❌ ' + error.message, 'error')
      setLoading(false)
      return
    }

    if (data.user) {
      const { data: profile } = await getProfile(data.user.id)

      if (profile?.status === 'pending') {
        showToast('⏳ Akun menunggu persetujuan admin', 'warning')
        setLoading(false)
        return
      }
      if (profile?.status === 'rejected') {
        showToast('❌ Akun ditolak. Hubungi admin.', 'error')
        setLoading(false)
        return
      }
      if (profile?.status === 'approved') {
        if (profile.role === 'admin') {
          navigate('/admin')
        } else {
          navigate('/dashboard')
        }
      }
    }
    setLoading(false)
  }

  return (
    <div className="container" style={{ paddingTop: '40px' }}>
      <div className="card">
        <div className="text-center" style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: '24px', fontWeight: 700 }}>🔐 Masuk</h2>
          <p style={{ color: 'var(--gray-500)', fontSize: '14px' }}>Masuk ke akun Anda</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="email">Email</label>
            <input type="email" id="email" className="form-input" placeholder="email@anda.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="password">Kata Sandi</label>
            <input type="password" id="password" className="form-input" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? '⏳ Memproses...' : 'Masuk'}
          </button>

          <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '14px', color: 'var(--gray-500)' }}>
            Belum punya akun? <Link to="/signup" style={{ color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>Daftar</Link>
          </div>
        </form>
      </div>
    </div>
  )
}
