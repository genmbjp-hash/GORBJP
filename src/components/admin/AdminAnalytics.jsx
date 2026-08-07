// src/components/admin/AdminAnalytics.jsx

import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { formatPrice } from '../../lib/price'
import { useToast } from '../../contexts/ToastContext'

// Returns 'YYYY-MM-DD' for the given date AS SEEN IN JAKARTA TIME,
// regardless of the browser/server's own local timezone. Using
// toISOString() (UTC) here would bucket any booking created between
// midnight and 7am WIB onto the previous calendar day, since Jakarta is
// UTC+7 — this isn't a "device might be misconfigured" edge case, it's a
// guaranteed shift for a business that always operates in WIB.
function getWIBDateKey(date) {
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
}

export default function AdminAnalytics() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    revenue: { total: 0, today: 0, week: 0, month: 0 },
    bookings: { total: 0, today: 0, active: 0, cancelled: 0 },
    donations: { total: 0, count: 0 },
    vouchers: { used: 0, discount: 0 },
    dailyBookings: []
  })
  const { showToast } = useToast()

  const loadAnalytics = useCallback(async () => {
    setLoading(true)
    try {
      // Anchor "today"/"week ago"/"month ago" to WIB midnight, not the
      // browser's local timezone — same reasoning as getWIBDateKey above.
      const now = new Date()
      const todayKeyWIB = getWIBDateKey(now)
      const today = new Date(`${todayKeyWIB} 00:00:00+07:00`)
      const weekAgo = new Date(today)
      weekAgo.setDate(weekAgo.getDate() - 7)
      const monthAgo = new Date(today)
      monthAgo.setDate(monthAgo.getDate() - 30)

      // ✅ Get all bookings
      const { data: bookings, error } = await supabase
        .from('bookings')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      // ✅ Calculate stats
      const revenue = { total: 0, today: 0, week: 0, month: 0 }
      const donations = { total: 0, count: 0 }
      const bookingStats = { total: 0, today: 0, active: 0, cancelled: 0 }
      const voucherStats = { used: 0, discount: 0 }
      
      // ✅ Daily bookings for chart (last 7 days, WIB calendar days)
      const dailyMap = {}
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today)
        d.setDate(d.getDate() - i)
        const key = getWIBDateKey(d)
        dailyMap[key] = { date: key, count: 0, revenue: 0 }
      }

      bookings?.forEach(b => {
        const created = new Date(b.created_at)
        const dateKey = getWIBDateKey(created)

        // Bookings count
        // NOTE: there's no distinct "expired" payment_status anywhere in
        // this codebase — every cancellation path (customer-cancel,
        // admin-cancel, abandoned payment) writes status: 'cancelled'.
        // A previous version of this stat tried to split out an
        // "expired" bucket by checking payment_status === 'expired',
        // but nothing ever sets that value, so it was permanently stuck
        // at 0 and silently miscounting real expirations as plain
        // "cancelled". Rather than fake a distinction the data can't
        // actually support, everything cancelled/expired is counted
        // together here — accurate, if less granular.
        bookingStats.total++
        if (created >= today) bookingStats.today++
        if (b.status === 'active') bookingStats.active++
        if (b.status === 'cancelled') bookingStats.cancelled++

        // Revenue (only paid bookings)
        if (b.payment_status === 'paid' || b.payment_status === 'free') {
          const price = b.price || 0
          revenue.total += price
          if (created >= today) revenue.today += price
          if (created >= weekAgo) revenue.week += price
          if (created >= monthAgo) revenue.month += price

          // Donations
          if (b.donation_amount > 0) {
            donations.total += b.donation_amount
            donations.count++
          }

          // Daily chart
          if (dailyMap[dateKey]) {
            dailyMap[dateKey].count++
            dailyMap[dateKey].revenue += price
          }

          // Vouchers — scoped inside the paid/free check on purpose.
          // Voucher usage currently gets recorded the moment a PENDING
          // booking is created (before payment is confirmed), and never
          // rolled back if that booking is later abandoned or cancelled.
          // Counting it here unconditionally would overstate how much
          // discount was actually given to paying customers — this only
          // reflects vouchers used on bookings that were genuinely paid.
          if (b.voucher_id && b.discount_applied > 0) {
            voucherStats.used++
            voucherStats.discount += b.discount_applied
          }
        }
      })

      const dailyBookings = Object.values(dailyMap)

      setStats({
        revenue,
        bookings: bookingStats,
        donations,
        vouchers: voucherStats,
        dailyBookings
      })

    } catch (error) {
      console.error('Error loading analytics:', error)
      showToast('❌ Gagal memuat data analytics', 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    loadAnalytics()
  }, [loadAnalytics])

  if (loading) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
        <div className="spinner" style={{ margin: '0 auto' }}></div>
        <p style={{ marginTop: '16px', color: 'var(--gray-500)' }}>Memuat data analytics...</p>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">📊 Analytics</span>
        <button onClick={loadAnalytics} className="btn btn-outline btn-sm" style={{ width: 'auto' }}>
          🔄 Refresh
        </button>
      </div>

      {/* ===== REVENUE ===== */}
      <div style={{ marginBottom: '16px' }}>
        <h4 style={{ fontSize: '14px', color: 'var(--gray-500)', marginBottom: '8px' }}>💰 Pendapatan</h4>
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          <div className="stat-card" style={{ padding: '10px' }}>
            <div className="stat-number" style={{ fontSize: '18px', color: 'var(--success)' }}>{formatPrice(stats.revenue.total)}</div>
            <div className="stat-label">Total</div>
          </div>
          <div className="stat-card" style={{ padding: '10px' }}>
            <div className="stat-number" style={{ fontSize: '18px' }}>{formatPrice(stats.revenue.today)}</div>
            <div className="stat-label">Hari Ini</div>
          </div>
          <div className="stat-card" style={{ padding: '10px' }}>
            <div className="stat-number" style={{ fontSize: '18px' }}>{formatPrice(stats.revenue.week)}</div>
            <div className="stat-label">7 Hari</div>
          </div>
          <div className="stat-card" style={{ padding: '10px' }}>
            <div className="stat-number" style={{ fontSize: '18px' }}>{formatPrice(stats.revenue.month)}</div>
            <div className="stat-label">30 Hari</div>
          </div>
        </div>
      </div>

      {/* ===== BOOKINGS ===== */}
      <div style={{ marginBottom: '16px' }}>
        <h4 style={{ fontSize: '14px', color: 'var(--gray-500)', marginBottom: '8px' }}>📋 Booking</h4>
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
          <div className="stat-card" style={{ padding: '10px' }}>
            <div className="stat-number" style={{ fontSize: '18px' }}>{stats.bookings.total}</div>
            <div className="stat-label">Total</div>
          </div>
          <div className="stat-card" style={{ padding: '10px' }}>
            <div className="stat-number" style={{ fontSize: '18px', color: 'var(--success)' }}>{stats.bookings.today}</div>
            <div className="stat-label">Hari Ini</div>
          </div>
          <div className="stat-card" style={{ padding: '10px' }}>
            <div className="stat-number" style={{ fontSize: '18px', color: 'var(--primary)' }}>{stats.bookings.active}</div>
            <div className="stat-label">Aktif</div>
          </div>
          <div className="stat-card" style={{ padding: '10px' }}>
            <div className="stat-number" style={{ fontSize: '18px', color: 'var(--danger)' }}>{stats.bookings.cancelled}</div>
            <div className="stat-label">Dibatalkan</div>
          </div>
        </div>
      </div>

      {/* ===== DONATIONS ===== */}
      <div style={{ marginBottom: '16px' }}>
        <h4 style={{ fontSize: '14px', color: 'var(--gray-500)', marginBottom: '8px' }}>🙏 Donasi</h4>
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
          <div className="stat-card" style={{ padding: '10px' }}>
            <div className="stat-number" style={{ fontSize: '18px', color: '#8B5CF6' }}>{formatPrice(stats.donations.total)}</div>
            <div className="stat-label">Total Donasi</div>
          </div>
          <div className="stat-card" style={{ padding: '10px' }}>
            <div className="stat-number" style={{ fontSize: '18px', color: '#8B5CF6' }}>{stats.donations.count}</div>
            <div className="stat-label">Jumlah Donasi</div>
          </div>
        </div>
      </div>

      {/* ===== VOUCHERS ===== */}
      <div style={{ marginBottom: '16px' }}>
        <h4 style={{ fontSize: '14px', color: 'var(--gray-500)', marginBottom: '8px' }}>🎫 Voucher</h4>
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
          <div className="stat-card" style={{ padding: '10px' }}>
            <div className="stat-number" style={{ fontSize: '18px', color: '#E0E7FF' }}>{stats.vouchers.used}</div>
            <div className="stat-label">Digunakan</div>
          </div>
          <div className="stat-card" style={{ padding: '10px' }}>
            <div className="stat-number" style={{ fontSize: '18px', color: 'var(--danger)' }}>{formatPrice(stats.vouchers.discount)}</div>
            <div className="stat-label">Total Diskon</div>
          </div>
        </div>
      </div>

      {/* ===== DAILY CHART (simple bar chart) ===== */}
      <div>
        <h4 style={{ fontSize: '14px', color: 'var(--gray-500)', marginBottom: '8px' }}>📈 Booking per Hari (7 Hari)</h4>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-end', height: '120px', paddingTop: '8px' }}>
          {stats.dailyBookings.map((day, index) => {
            const max = Math.max(...stats.dailyBookings.map(d => d.count), 1)
            const height = (day.count / max) * 100
            return (
              <div key={index} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ 
                  width: '100%', 
                  height: `${height}%`, 
                  backgroundColor: day.count > 0 ? 'var(--primary)' : 'var(--gray-200)',
                  borderRadius: '4px 4px 0 0',
                  minHeight: day.count > 0 ? '4px' : '0',
                  transition: 'height 0.3s'
                }}></div>
                <span style={{ fontSize: '10px', color: 'var(--gray-400)', marginTop: '4px' }}>
                  {day.date.split('-').slice(1).join('/')}
                </span>
                <span style={{ fontSize: '9px', color: 'var(--gray-500)', fontWeight: 600 }}>
                  {day.count}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
