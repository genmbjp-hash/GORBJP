// src/components/admin/AdminMasterPin.jsx

import React, { useState } from 'react'
import { generateMasterPin } from '../../lib/api'
import { useToast } from '../../hooks/useToast'

export default function AdminMasterPin() {
  const [duration, setDuration] = useState(8)
  const [purpose, setPurpose] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const { showToast } = useToast()

  async function handleGenerate() {
    if (!duration || duration < 1) {
      showToast('❌ Durasi minimal 1 jam', 'error')
      return
    }

    setLoading(true)
    try {
      const response = await generateMasterPin(duration * 60, purpose)
      setResult(response)
      showToast(`✅ Master PIN generated: ${response.pin}`, 'success')
    } catch (error) {
      showToast('❌ ' + error.message, 'error')
    }
    setLoading(false)
  }

  return (
    <div>
      <div className="card-header">
        <span className="card-title">🔑 Generate PIN Master</span>
        <span className="badge badge-warning">Admin Only</span>
      </div>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '120px' }}>
          <label className="form-label" style={{ fontSize: '12px' }}>Durasi (jam)</label>
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
          <label className="form-label" style={{ fontSize: '12px' }}>Tujuan</label>
          <input
            type="text"
            className="form-input"
            placeholder="Maintenance, dll"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            style={{ padding: '10px 12px' }}
          />
        </div>
      </div>
      <button onClick={handleGenerate} className="btn btn-warning" style={{ marginTop: '12px' }} disabled={loading}>
        {loading ? '⏳ Generating...' : '🔑 Generate PIN Master'}
      </button>
      {result && (
        <div style={{ marginTop: '12px', padding: '16px', background: 'var(--warning)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
          <p style={{ fontWeight: 600 }}>🔑 PIN Master</p>
          <p style={{ fontSize: '32px', fontWeight: 800, letterSpacing: '4px', color: 'var(--gray-900)' }}>{result.pin}</p>
          <p style={{ fontSize: '14px' }}>Berlaku {duration} jam (sampai {new Date(result.expires_at).toLocaleString('id-ID')})</p>
        </div>
      )}
    </div>
  )
}
