// src/components/admin/AdminMasterPin.jsx

import React, { useState, useCallback, useEffect, useMemo, memo } from 'react'
import { generateMasterPin } from '../../lib/api'
import { supabase } from '../../lib/supabase'
import { useToast } from '../../contexts/ToastContext'

// ============================================
// MASTER PIN HISTORY ITEM (memoized)
// ============================================

const MasterPinHistoryItem = memo(function MasterPinHistoryItem({ pin }) {
  const isExpired = new Date(pin.expires_at) < new Date()
  
  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center',
      padding: '8px 12px',
      borderBottom: '1px solid var(--gray-100)',
      flexWrap: 'wrap',
      gap: '8px'
    }}>
      <div>
        <span style={{ 
          fontWeight: 700, 
          fontSize: '16px', 
          letterSpacing: '2px',
          color: isExpired ? 'var(--gray-400)' : 'var(--primary)'
        }}>
          {pin.pin}
        </span>
        {pin.purpose && (
          <span style={{ marginLeft: '8px', fontSize: '12px', color: 'var(--gray-500)' }}>
            📝 {pin.purpose}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '12px', color: 'var(--gray-500)' }}>
          {new Date(pin.expires_at).toLocaleString('id-ID')}
        </span>
        <span className={`badge ${isExpired ? 'badge-cancelled' : 'badge-active'}`}>
          {isExpired ? '⏰ Expired' : '✅ Active'}
        </span>
      </div>
    </div>
  )
})

// ============================================
// MAIN COMPONENT
// ============================================

export default function AdminMasterPin() {
  const [duration, setDuration] = useState(8)
  const [purpose, setPurpose] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [pinHistory, setPinHistory] = useState([])
  const [showHistory, setShowHistory] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const { showToast } = useToast()

  // ✅ Load PIN history
  const loadPinHistory = useCallback(async () => {
    if (!showHistory) return
    
    setLoadingHistory(true)
    try {
      const { data, error } = await supabase
        .from('master_pins')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20) // ✅ Only load 20 most recent

      if (error) {
        console.error('Error loading PIN history:', error)
      } else {
        setPinHistory(data || [])
      }
    } catch (error) {
      console.error('Error loading PIN history:', error)
    } finally {
      setLoadingHistory(false)
    }
  }, [showHistory])

  // ✅ Load history when toggled
  useEffect(() => {
    if (showHistory) {
      loadPinHistory()
    }
  }, [showHistory, loadPinHistory])

  // ✅ Generate PIN
  const handleGenerate = useCallback(async () => {
    if (!duration || duration < 1) {
      showToast('❌ Durasi minimal 1 jam', 'error')
      return
    }

    if (duration > 24) {
      showToast('⚠️ Durasi maksimal 24 jam', 'warning')
      return
    }

    setLoading(true)
    setResult(null)
    
    try {
      const response = await generateMasterPin(duration * 60, purpose)
      setResult(response)
      showToast(`✅ Master PIN generated: ${response.pin}`, 'success')
      
      // ✅ Refresh history if open
      if (showHistory) {
        loadPinHistory()
      }
    } catch (error) {
      showToast('❌ ' + error.message, 'error')
    } finally {
      setLoading(false)
    }
  }, [duration, purpose, showToast, showHistory, loadPinHistory])

  // ✅ Copy PIN to clipboard
  const handleCopyPin = useCallback(async () => {
    if (!result?.pin) return
    
    try {
      await navigator.clipboard.writeText(result.pin)
      showToast('📋 PIN copied to clipboard!', 'success')
    } catch (error) {
      // Fallback: select text
      const pinElement = document.getElementById('master-pin-display')
      if (pinElement) {
        const range = document.createRange()
        range.selectNode(pinElement)
        window.getSelection().removeAllRanges()
        window.getSelection().addRange(range)
        showToast('📋 PIN selected, copy manually', 'info')
      }
    }
  }, [result, showToast])

  // ✅ Quick duration presets
  const durationPresets = useMemo(() => [2, 4, 8, 12, 24], [])

  // ✅ Clear result
  const handleClearResult = useCallback(() => {
    setResult(null)
  }, [])

  // ✅ Memoized stats
  const stats = useMemo(() => {
    const active = pinHistory.filter(p => new Date(p.expires_at) > new Date())
    return {
      total: pinHistory.length,
      active: active.length,
    }
  }, [pinHistory])

  return (
    <div>
      <div className="card-header">
        <span className="card-title">🔑 Generate PIN Master</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="badge badge-warning">Admin Only</span>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="btn btn-outline btn-sm"
            style={{ width: 'auto', minHeight: '30px', padding: '4px 12px', fontSize: '12px' }}
          >
            {showHistory ? '📋 Hide History' : '📋 Show History'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '120px' }}>
          <label className="form-label" style={{ fontSize: '12px' }}>Durasi (jam) *</label>
          <input
            type="number"
            className="form-input"
            value={duration}
            onChange={(e) => setDuration(parseInt(e.target.value) || 0)}
            min="1"
            max="24"
            style={{ padding: '10px 12px' }}
          />
        </div>
        <div style={{ flex: 2, minWidth: '150px' }}>
          <label className="form-label" style={{ fontSize: '12px' }}>Tujuan (opsional)</label>
          <input
            type="text"
            className="form-input"
            placeholder="Maintenance, Private Event, dll"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            style={{ padding: '10px 12px' }}
            maxLength={100}
          />
        </div>
      </div>

      {/* ✅ Duration presets */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
        <span style={{ fontSize: '12px', color: 'var(--gray-500)', marginRight: '4px' }}>Cepat:</span>
        {durationPresets.map(h => (
          <button
            key={h}
            onClick={() => setDuration(h)}
            className={`btn btn-sm ${duration === h ? 'btn-primary' : 'btn-outline'}`}
            style={{ 
              width: 'auto', 
              minHeight: '28px', 
              padding: '2px 12px', 
              fontSize: '12px',
              fontWeight: duration === h ? 600 : 400
            }}
          >
            {h} jam
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
        <button 
          onClick={handleGenerate} 
          className="btn btn-warning" 
          style={{ flex: 1, minWidth: '150px' }}
          disabled={loading || !duration}
        >
          {loading ? '⏳ Generating...' : '🔑 Generate PIN Master'}
        </button>
        {result && (
          <button 
            onClick={handleClearResult} 
            className="btn btn-outline" 
            style={{ width: 'auto', padding: '0 16px' }}
          >
            ✕ Clear
          </button>
        )}
      </div>

      {/* ✅ Result display */}
      {result && (
        <div style={{ 
          marginTop: '12px', 
          padding: '16px', 
          background: 'var(--warning)', 
          borderRadius: 'var(--radius-sm)', 
          textAlign: 'center',
          animation: 'fadeIn 0.3s ease-in'
        }}>
          <p style={{ fontWeight: 600 }}>🔑 PIN Master</p>
          <p 
            id="master-pin-display"
            style={{ 
              fontSize: '32px', 
              fontWeight: 800, 
              letterSpacing: '4px', 
              color: 'var(--gray-900)',
              cursor: 'pointer',
              userSelect: 'all'
            }}
            onClick={handleCopyPin}
            title="Click to copy"
          >
            {result.pin}
          </p>
          <p style={{ fontSize: '14px' }}>
            Berlaku {duration} jam (sampai {new Date(result.expires_at).toLocaleString('id-ID')})
          </p>
          <button
            onClick={handleCopyPin}
            className="btn btn-sm btn-outline"
            style={{ 
              width: 'auto', 
              minHeight: '30px', 
              padding: '4px 16px', 
              fontSize: '12px',
              marginTop: '8px'
            }}
          >
            📋 Copy PIN
          </button>
        </div>
      )}

      {/* ✅ PIN History */}
      {showHistory && (
        <div style={{ 
          marginTop: '16px',
          borderTop: '1px solid var(--gray-200)',
          paddingTop: '12px'
        }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: '8px'
          }}>
            <span style={{ fontSize: '14px', fontWeight: 600 }}>
              📋 Riwayat PIN Master
              {stats.total > 0 && (
                <span style={{ marginLeft: '8px', fontSize: '12px', fontWeight: 400, color: 'var(--gray-500)' }}>
                  ({stats.active} aktif dari {stats.total})
                </span>
              )}
            </span>
            <button
              onClick={loadPinHistory}
              className="btn btn-outline btn-sm"
              style={{ width: 'auto', minHeight: '28px', padding: '2px 12px', fontSize: '11px' }}
              disabled={loadingHistory}
            >
              {loadingHistory ? '⏳' : '🔄'}
            </button>
          </div>

          {loadingHistory ? (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <div className="spinner" style={{ margin: '0 auto', width: '24px', height: '24px' }}></div>
              <p style={{ marginTop: '8px', fontSize: '12px', color: 'var(--gray-500)' }}>Memuat riwayat...</p>
            </div>
          ) : pinHistory.length === 0 ? (
            <p style={{ color: 'var(--gray-400)', textAlign: 'center', padding: '12px', fontSize: '14px' }}>
              Belum ada PIN Master yang digenerate
            </p>
          ) : (
            <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
              {pinHistory.map(pin => (
                <MasterPinHistoryItem key={pin.id} pin={pin} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
