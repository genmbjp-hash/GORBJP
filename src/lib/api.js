// src/lib/api.js

import { supabase } from './supabase'
import { calculatePrice, calculateDiscount } from './price'

const EDGE_FUNCTION_URL = import.meta.env.VITE_SUPABASE_URL + '/functions/v1'

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

export async function getVouchers() {
  const { data, error } = await supabase
    .from('vouchers')
    .select('*, profiles(full_name, display_name)')
    .order('created_at', { ascending: false })

  if (error) throw error
  return data
}

// ✅ FIXED: Use UTC for database updates
export async function updateVoucher(voucherId, updates) {
  const now = new Date()
  const nowUTC = new Date(now.getTime() - now.getTimezoneOffset() * 60000)

  const { data, error } = await supabase
    .from('vouchers')
    .update({
      ...updates,
      updated_at: nowUTC.toISOString()
    })
    .eq('id', voucherId)
    .select()
    .single()

  if (error) throw error
  return data
}

// ✅ FIXED: Use UTC for database updates
export async function deactivateVoucher(voucherId) {
  const now = new Date()
  const nowUTC = new Date(now.getTime() - now.getTimezoneOffset() * 60000)

  const { data, error } = await supabase
    .from('vouchers')
    .update({ 
      active: false, 
      updated_at: nowUTC.toISOString() 
    })
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

// ✅ FIXED: Use UTC for expiry check
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

  // ✅ Use UTC for expiry check
  const now = new Date()
  const nowUTC = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
  if (data.expires_at && new Date(data.expires_at) < nowUTC) {
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

// ✅ FIXED: createBooking with UTC
export async function createBooking(userId, slotData, duration, voucherId) {
  const { date, hour } = slotData

  // Convert to UTC
  const startDateTime = new Date(date)
  startDateTime.setHours(hour, 0, 0, 0)
  const startUTC = new Date(startDateTime.getTime() - startDateTime.getTimezoneOffset() * 60000)
  
  const endDateTime = new Date(startDateTime)
  endDateTime.setHours(hour + duration, 0, 0, 0)
  const endUTC = new Date(endDateTime.getTime() - endDateTime.getTimezoneOffset() * 60000)

  // UTC date range for conflict check
  const startOfDay = new Date(date)
  startOfDay.setHours(0, 0, 0, 0)
  const startOfDayUTC = new Date(startOfDay.getTime() - startOfDay.getTimezoneOffset() * 60000)
  const endOfDayUTC = new Date(startOfDayUTC)
  endOfDayUTC.setHours(23, 59, 59, 999)

  // Check for existing bookings
  const { data: existing, error: checkError } = await supabase
    .from('bookings')
    .select('*')
    .in('status', ['pending', 'active'])
    .gte('start_time', startOfDayUTC.toISOString())
    .lte('start_time', endOfDayUTC.toISOString())
    .filter('start_time', 'lt', endUTC.toISOString())
    .filter('end_time', 'gt', startUTC.toISOString())

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

  // ✅ Insert with UTC
  const { data, error } = await supabase
    .from('bookings')
    .insert({
      user_id: userId,
      pin: null,
      start_time: startUTC.toISOString(),
      end_time: endUTC.toISOString(),
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
