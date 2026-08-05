// src/lib/api.js

import { supabase } from './supabase'
import { calculatePrice, calculateDiscount } from './price'

const EDGE_FUNCTION_URL = import.meta.env.VITE_SUPABASE_URL + '/functions/v1'

/**
 * Call an Edge Function with authentication
 */
async function callEdgeFunction(functionName, body) {
  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token

  if (!token) {
    throw new Error('Not authenticated')
  }

  const response = await fetch(`${EDGE_FUNCTION_URL}/${functionName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })

  const result = await response.json()

  if (!response.ok) {
    throw new Error(result.error || 'Something went wrong')
  }

  return result
}

// ============================================
// EDGE FUNCTION CALLS
// ============================================

export async function confirmPayment(bookingId) {
  return callEdgeFunction('confirm-payment', { bookingId })
}

export async function approveUser(userId, action) {
  return callEdgeFunction('approve-user', { userId, action })
}

export async function createVoucher(voucherData) {
  return callEdgeFunction('create-voucher', voucherData)
}

export async function generateMasterPin(durationMinutes, purpose) {
  return callEdgeFunction('generate-master-pin', { duration_minutes: durationMinutes, purpose })
}

export async function forceLamp(state) {
  return callEdgeFunction('force-lamp', { state })
}

// ============================================
// DIRECT SUPABASE CALLS (for voucher management)
// ============================================

export async function getVouchers() {
  const { data, error } = await supabase
    .from('vouchers')
    .select('*, profiles(full_name, display_name)')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

export async function updateVoucher(voucherId, updates) {
  const { data, error } = await supabase
    .from('vouchers')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', voucherId)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deactivateVoucher(voucherId) {
  const { data, error } = await supabase
    .from('vouchers')
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq('id', voucherId)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteVoucher(voucherId) {
  const { data, error } = await supabase
    .from('vouchers')
    .delete()
    .eq('id', voucherId)
    .select()
    .single()

  if (error) throw error
  return data
}

// ============================================
// VOUCHER VALIDATION
// ============================================

export async function validateVoucher(code, duration) {
  const { data, error } = await supabase
    .from('vouchers')
    .select('*')
    .eq('code', code.toUpperCase())
    .single()

  if (error) return { error: { message: 'Kode voucher tidak ditemukan' } }
  if (!data) return { error: { message: 'Kode voucher tidak ditemukan' } }

  if (!data.active) {
    return { error: { message: 'Voucher sudah tidak aktif' } }
  }

  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    return { error: { message: 'Voucher sudah kadaluarsa' } }
  }

  if (data.max_uses > 0 && data.used_count >= data.max_uses) {
    return { error: { message: 'Voucher sudah mencapai batas penggunaan' } }
  }

  if (duration < data.min_duration) {
    return { error: { message: `Minimal booking ${data.min_duration} jam untuk voucher ini` } }
  }

  if (data.max_duration && duration > data.max_duration) {
    return { error: { message: `Maksimal booking ${data.max_duration} jam untuk voucher ini` } }
  }

  return { data, error: null }
}

// ============================================
// CREATE BOOKING
// ============================================

export async function createBooking(userId, slotData, duration, voucherId) {
  // ✅ Check if userId is valid
  if (!userId) {
    return { error: { message: 'User not authenticated' } }
  }

  console.log('📤 Creating booking for user:', userId)
  const { date, hour } = slotData

  const startDateTime = new Date(date)
  startDateTime.setHours(hour, 0, 0, 0)
  const endDateTime = new Date(startDateTime)
  endDateTime.setHours(hour + duration, 0, 0, 0)

  const startOfDay = new Date(date)
  startOfDay.setHours(0, 0, 0, 0)
  const endOfDay = new Date(date)
  endOfDay.setHours(23, 59, 59, 999)

  const { data: existing, error: checkError } = await supabase
    .from('bookings')
    .select('*')
    .in('status', ['pending', 'active'])
    .gte('start_time', startOfDay.toISOString())
    .lte('start_time', endOfDay.toISOString())
    .filter('start_time', 'lt', endDateTime.toISOString())
    .filter('end_time', 'gt', startDateTime.toISOString())

  if (checkError) return { error: checkError }
  if (existing.length > 0) {
    return { error: { message: 'Slot sudah tidak tersedia' } }
  }

  const originalPrice = calculatePrice(duration)

  let finalPrice = originalPrice
  let discountApplied = 0
  let voucherIdToUse = null

  if (voucherId) {
    const { data: voucher } = await supabase
      .from('vouchers')
      .select('*')
      .eq('id', voucherId)
      .single()

    if (voucher) {
      const discount = calculateDiscount(originalPrice, voucher)
      discountApplied = discount
      finalPrice = originalPrice - discount
      if (voucher.discount_type === 'free') {
        finalPrice = 1
        discountApplied = originalPrice - 1
      }
      voucherIdToUse = voucherId
    }
  }

  const { data, error } = await supabase
    .from('bookings')
    .insert({
      user_id: userId,
      pin: null,
      start_time: startDateTime.toISOString(),
      end_time: endDateTime.toISOString(),
      duration_hours: duration,
      original_price: originalPrice,
      price: finalPrice,
      discount_applied: discountApplied,
      payment_status: 'pending',
      payment_method: voucherIdToUse ? 'voucher' : 'pending',
      status: 'pending',
      voucher_id: voucherIdToUse,
    })
    .select()
    .single()

  if (error) return { error }

  if (voucherIdToUse) {
    await supabase.rpc('increment_voucher_usage', { voucher_id: voucherIdToUse })
    await supabase.from('voucher_usage').insert({
      voucher_id: voucherIdToUse,
      user_id: userId,
      booking_id: data.id,
    })
  }

  return { data, error }
}
