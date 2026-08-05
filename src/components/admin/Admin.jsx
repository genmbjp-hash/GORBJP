// src/components/Admin.jsx — Main Container

import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../hooks/useToast'
import { confirmPayment, approveUser, generateMasterPin, forceLamp } from '../../lib/api'
import AdminUsers from './AdminUsers'
import AdminVouchers from './AdminVouchers'
import AdminBookings from './AdminBookings'
import AdminMasterPin from './AdminMasterPin'

export default function Admin() {
  const { user, isAdmin, signOut } = useAuth()
  const [bookings, setBookings] = useState([])
  const [stats, setStats] = useState({ pending: 0, today: 0, active: 0, total: 0 })
  const [loading, setLoading] = useState(true)
  const [deviceStatus, setDeviceStatus] = useState(null)
  const navigate = useNavigate()
  const { showToast } = useToast()

  useEffect(() => {
    if (!isAdmin) {
      navigate('/dashboard')
      return
    }
    loadAllData()
  }, [isAdmin])

  async function loadAllData() {
    setLoading(true)
    await Promise.all([
      loadBookings(),
      loadDeviceStatus(),
    ])
    setLoading(false)
  }

  async function loadBookings() {
    const { data } = await supabase
      .from('bookings')
      .select('*, profiles(display_name, full_name, email, phone, block, house_number)')
      .order('start_time', { ascending: false })

    if (data) {
      setBookings(data)
      const today = new Date().toDateString()
      const todayBookings = data.filter(b => new Date(b.start_time).toDateString() === today)
      const active = data.filter(b => b.status === 'active' || b.status === 'pending')

      setStats({
        pending: data.filter(b => b.status === 'pending').length,
        today: todayBookings.length,
        active: active.length,
        total: data.length,
      })
    }
  }

  async function loadDeviceStatus() {
    const { data } = await supabase
      .from('device_status')
      .select('*')
      .eq('device_mac', 'AA:BB:CC:DD:EE:FF')
      .maybeSingle()
    setDeviceStatus(data)
  }

  async function handleForceLamp(state) {
    try {
      await forceLamp(state)
      showToast(`💡 Lampu ${state === 'on' ? 'ON' : 'OFF'}`, 'success')
      loadDeviceStatus()
    } catch (error) {
      showToast('❌ ' + error.message, 'error')
    }
  }

  if (loading) {
    return (
      <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div className="spinner"></div>
      </div>
    )
  }

  return (
    <div className="container" style={{ paddingTop: '16px' }}>
      <div className="header" style={{ padding: '0 0 16px 0', borderBottom: '2px solid var(--gray-100)' }}>
        <div className="header-content" style={{ padding: 0 }}>
          <div className="logo">
            <span className="logo-icon">🏛️</span>
            <div>
              <span className="logo-text">Gedung Serbaguna BJP</span>
              <span className="logo-sub">👑 Panel Admin</span>
            </div>
          </div>
          <button onClick={signOut} className="btn btn-outline btn-sm" style={{ width: 'auto', minHeight: '36px', padding: '4px 16px' }}>
            Keluar
          </button>
        </div>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <button onClick={() => navigate('/booking')} className="btn btn-primary" style={{ width: '100%' }}>
          📖 Book Venue
        </button>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="stat-card">
          <div className="stat-number">{stats.pending}</div>
          <div className="stat-label">Menunggu</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{stats.today}</div>
          <div className="stat-label">Hari Ini</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{stats.active}</div>
          <div className="stat-label">Aktif</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{stats.total}</div>
          <div className="stat-label">Total</div>
        </div>
      </div>

      <AdminUsers />

      <div className="card" style={{ border: '2px solid var(--warning)' }}>
        <AdminMasterPin />
      </div>

      <AdminVouchers />

      <div className="card" style={{ border: '2px solid var(--primary)' }}>
        <div className="card-header">
          <span className="card-title">💡 Kontrol Lampu</span>
          <span className={`badge ${deviceStatus?.relay_state ? 'badge-active' : 'badge-cancelled'}`}>
            {deviceStatus?.relay_state ? '💡 ON' : '💡 OFF'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button onClick={() => handleForceLamp('on')} className="btn btn-success" style={{ flex: 1, minWidth: '100px' }}>
            💡 ON
          </button>
          <button onClick={() => handleForceLamp('off')} className="btn btn-danger" style={{ flex: 1, minWidth: '100px' }}>
            💡 OFF
          </button>
        </div>
        <div style={{ marginTop: '12px', fontSize: '14px', color: 'var(--gray-500)' }}>
          Terakhir terlihat: {deviceStatus ? new Date(deviceStatus.last_seen).toLocaleString('id-ID') : '-'}
        </div>
      </div>

      <AdminBookings bookings={bookings} onRefresh={loadBookings} />
    </div>
  )
}
