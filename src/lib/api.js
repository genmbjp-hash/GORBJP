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

export async function updateVoucher(voucherId, updates) {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const seconds = String(now.getSeconds()).padStart(2, '0')
  const nowWIB = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}+07:00`

  const { data, error } = await supabase
    .from('vouchers')
    .update({
      ...updates,
      updated_at: nowWIB
    })
    .eq('id', voucherId)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deactivateVoucher(voucherId) {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const seconds = String(now.getSeconds()).padStart(2, '0')
  const nowWIB = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}+07:00`

  const { data, error } = await supabase
    .from('vouchers')
    .update({ 
      active: false, 
      updated_at: nowWIB
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

  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const seconds = String(now.getSeconds()).padStart(2, '0')
  const nowWIB = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}+07:00`

  if (data.expires_at && new Date(data.expires_at) < new Date(nowWIB)) {
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

export async function createBooking(userId, slotData, duration, voucherId, donationAmount = 0) {
  const { date, hour } = slotData

  // `date` arrives as a 'YYYY-MM-DD' local-date string (see
  // CheckoutSheet's getLocalDateString), not a Date object — parse the
  // parts directly instead of calling Date methods on it.
  const [year, month, day] = date.split('-')
  const hours = String(hour).padStart(2, '0')
  const endHour = String(hour + duration).padStart(2, '0')
  
  const startWIB = `${year}-${month}-${day} ${hours}:00:00+07:00`
  const endWIB = `${year}-${month}-${day} ${endHour}:00:00+07:00`
  const startOfDayWIB = `${year}-${month}-${day} 00:00:00+07:00`
  const endOfDayWIB = `${year}-${month}-${day} 23:59:59+07:00`

  const { data: existing, error: checkError } = await supabase
    .from('bookings')
    .select('*')
    .in('status', ['pending', 'active'])
    .gte('start_time', startOfDayWIB)
    .lte('start_time', endOfDayWIB)
    .filter('start_time', 'lt', endWIB)
    .filter('end_time', 'gt', startWIB)

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
        finalPrice = 1000
        discountApplied = originalPrice - 1000
      }
      voucherIdToUse = voucherId
    }
  }

  // ✅ Add donation to final price
  const donationAmountInt = parseInt(donationAmount) || 0
  const priceWithDonation = finalPrice + donationAmountInt

  const { data, error } = await supabase
    .from('bookings')
    .insert({
      user_id: userId,
      pin: null,
      start_time: startWIB,
      end_time: endWIB,
      duration_hours: duration,
      original_price: originalPrice,
      price: priceWithDonation,  // ✅ Total includes donation
      discount_applied: discountApplied,
      payment_status: 'pending',
      payment_method: voucherIdToUse ? 'voucher' : 'pending',
      status: 'pending',
      voucher_id: voucherIdToUse,
      donation_amount: donationAmountInt,  // ✅ Store donation separately
    })
    .select()
    .single()

  if (error) {
    // Postgres exclusion_violation: another booking for an overlapping
    // time range was inserted between our overlap check above and this
    // insert (a race). Surface the same friendly message the pre-check
    // above uses, instead of a raw DB error.
    if (error.code === '23P01') {
      return { error: { message: 'Slot sudah tidak tersedia' } }
    }
    return { error }
  }

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

export async function createPaymentLink(bookingId, amount, customer, donationAmount = 0) {
  try {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-payment-link`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({
          booking_id: bookingId,
          amount: amount,
          customer_name: customer?.display_name || customer?.full_name || 'Customer',
          customer_email: customer?.email || '-',
          customer_phone: customer?.phone || '-',
          donation_amount: donationAmount || 0
        })
      }
    )

    const result = await response.json()
    return result
  } catch (error) {
    console.error('Create payment link error:', error)
    return { success: false, error: error.message }
  }
}

// src/lib/api.js — Add these functions

export async function getAnalytics() {
  try {
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-analytics`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
        }
      }
    )

    const result = await response.json()
    return result
  } catch (error) {
    console.error('Get analytics error:', error)
    return { success: false, error: error.message }
  }
}
