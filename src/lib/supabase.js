// src/lib/supabase.js

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// ============================================
// AUTH FUNCTIONS
// ============================================

export async function signUp(email, password, fullName, displayName, phone, block, houseNumber) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        display_name: displayName,
        phone: phone,
        block: block,
        house_number: houseNumber
      }
    }
  })

  if (!error && data.user) {
    try {
      const profile = { display_name: displayName, full_name: fullName, email, phone, block, house_number }
      const EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/send-telegram`
      await fetch(EDGE_FUNCTION_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        },
        body: JSON.stringify({ profile, type: 'register' })
      })
    } catch (err) {
      // Silent fail
    }
  }

  return { data, error }
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  return { data, error }
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  return { error }
}

export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  return { data, error }
}

// ============================================
// BOOKING HELPERS
// ============================================

export async function getBookingsForDate(dateObj) {
  const startDate = new Date(dateObj)
  startDate.setHours(0, 0, 0, 0)
  const endDate = new Date(dateObj)
  endDate.setHours(23, 59, 59, 999)

  const { data, error } = await supabase
    .from('bookings')
    .select('*, profiles(full_name, display_name)')
    .gte('start_time', startDate.toISOString())
    .lte('start_time', endDate.toISOString())
    .in('status', ['pending', 'active', 'completed'])

  return { data, error }
}

export async function getUserBookings(userId) {
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('user_id', userId)
    .order('start_time', { ascending: true })

  return { data, error }
}

// ============================================
// VOUCHER HELPERS
// ============================================

export async function getVouchers() {
  const { data, error } = await supabase
    .from('vouchers')
    .select('*, profiles(full_name, display_name)')
    .order('created_at', { ascending: false })

  return { data, error }
}

export async function getVoucherByCode(code) {
  const { data, error } = await supabase
    .from('vouchers')
    .select('*')
    .eq('code', code.toUpperCase())
    .maybeSingle()

  return { data, error }
}
