import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// ============================================
// AUTH
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
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
        body: JSON.stringify({ profile, type: 'register' })
      })
    } catch (err) { /* silent fail */ }
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
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).single()
  return { data, error }
}

// ============================================
// BOOKINGS
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

export async function getAllBookings() {
  const { data, error } = await supabase
    .from('bookings')
    .select('*, profiles(full_name, display_name, email, phone, block, house_number)')
    .order('start_time', { ascending: false })
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

export async function completeExpiredBookings() {
  const now = new Date().toISOString()
  
  const { data, error } = await supabase
    .from('bookings')
    .update({ status: 'completed' })
    .in('status', ['pending', 'active'])
    .lt('end_time', now)
    .select()

  if (data && data.length > 0) {
    console.log(`✅ ${data.length} expired bookings completed`)
  }

  return { data, error }
}

export async function createBookingWithCheckout(userId, slotData, duration) {
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

  const { data: pinData, error: pinError } = await supabase.rpc('generate_pin')
  if (pinError) return { error: pinError }

  const { data, error } = await supabase
    .from('bookings')
    .insert({
      user_id: userId,
      pin: pinData,
      start_time: startDateTime.toISOString(),
      end_time: endDateTime.toISOString(),
      duration_hours: duration,
      price: 0,
      payment_status: 'free',
      payment_method: 'free',
      status: 'pending'
    })
    .select()
    .single()

  if (!error) {
    try {
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single()
      if (profile) {
        const EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/send-telegram`
        await fetch(EDGE_FUNCTION_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
          body: JSON.stringify({ booking: data, profile, type: 'booking' })
        })
      }
    } catch (err) { /* silent fail */ }
  }

  return { data, error }
}

export async function cancelBooking(bookingId, userId) {
  const { data, error } = await supabase
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('id', bookingId)
    .eq('user_id', userId)
    .select()
    .single()
  return { data, error }
}

// ============================================
// ADMIN
// ============================================

export async function getPendingUsers() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
  return { data, error }
}

export async function approveUser(userId, adminId) {
  const { data, error } = await supabase
    .from('profiles')
    .update({ status: 'approved', approved_at: new Date().toISOString(), approved_by: adminId })
    .eq('id', userId)
    .select()
    .single()
  return { data, error }
}

export async function rejectUser(userId, adminId) {
  const { data, error } = await supabase
    .from('profiles')
    .update({ status: 'rejected', approved_at: new Date().toISOString(), approved_by: adminId })
    .eq('id', userId)
    .select()
    .single()
  return { data, error }
}

export async function generateMasterPin(adminId, durationMinutes, purpose = '') {
  const pin = String(Math.floor(1000 + Math.random() * 9000))
  const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000)
  const { data, error } = await supabase
    .from('master_pins')
    .insert({
      pin, duration_minutes: durationMinutes, purpose,
      generated_by: adminId,
      expires_at: expiresAt.toISOString(),
      active: true
    })
    .select()
    .single()
  return { data, error }
}

export async function getActiveMasterPins() {
  const { data, error } = await supabase
    .from('master_pins')
    .select('*, profiles(full_name)')
    .eq('active', true)
    .gte('expires_at', new Date().toISOString())
  return { data, error }
}

export async function deactivateMasterPin(pinId, adminId) {
  const { data, error } = await supabase
    .from('master_pins')
    .update({ active: false })
    .eq('id', pinId)
    .select()
    .single()
  return { data, error }
}

// ============================================
// DEVICE
// ============================================

export async function getDeviceStatus() {
  const { data, error } = await supabase
    .from('device_status')
    .select('*')
    .eq('device_mac', 'AA:BB:CC:DD:EE:FF')
    .maybeSingle()
  return { data, error }
}

export async function forceLampOn(adminId) {
  const { data: existing } = await getDeviceStatus()
  let result
  if (!existing) {
    result = await supabase.from('device_status').insert({
      device_mac: 'AA:BB:CC:DD:EE:FF',
      relay_state: true,
      master_mode: false,
      last_seen: new Date().toISOString()
    }).select().single()
  } else {
    result = await supabase
      .from('device_status')
      .update({ relay_state: true, last_seen: new Date().toISOString() })
      .eq('device_mac', 'AA:BB:CC:DD:EE:FF')
      .select()
      .maybeSingle()
  }
  return result
}

export async function forceLampOff(adminId) {
  const { data: existing } = await getDeviceStatus()
  let result
  if (!existing) {
    result = await supabase.from('device_status').insert({
      device_mac: 'AA:BB:CC:DD:EE:FF',
      relay_state: false,
      master_mode: false,
      last_seen: new Date().toISOString()
    }).select().single()
  } else {
    result = await supabase
      .from('device_status')
      .update({ relay_state: false, last_seen: new Date().toISOString() })
      .eq('device_mac', 'AA:BB:CC:DD:EE:FF')
      .select()
      .maybeSingle()
  }
  return result
}

// ============================================
// PAYMENT FUNCTIONS
// ============================================

export async function createPendingBooking(userId, slotData, duration, price) {
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

  const paymentDeadline = new Date(Date.now() + 10 * 60 * 1000)

  const { data, error } = await supabase
    .from('bookings')
    .insert({
      user_id: userId,
      pin: null,
      start_time: startDateTime.toISOString(),
      end_time: endDateTime.toISOString(),
      duration_hours: duration,
      price: price,
      payment_status: 'pending',
      payment_method: 'dummy',
      status: 'pending',
      payment_deadline: paymentDeadline.toISOString()
    })
    .select()
    .single()

  return { data, error }
}

export async function confirmPayment(bookingId) {
  const { data: pinData, error: pinError } = await supabase.rpc('generate_pin')
  if (pinError) return { error: pinError }

  const { data, error } = await supabase
    .from('bookings')
    .update({
      status: 'active',
      pin: pinData,
      payment_status: 'paid'
    })
    .eq('id', bookingId)
    .eq('status', 'pending')
    .select()
    .single()

  if (!error) {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user_id)
        .single()
      if (profile) {
        const EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/send-telegram`
        await fetch(EDGE_FUNCTION_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
          body: JSON.stringify({ booking: data, profile, type: 'booking' })
        })
      }
    } catch (err) { /* silent fail */ }
  }

  return { data, error }
}

export async function cancelPendingBooking(bookingId) {
  const { data, error } = await supabase
    .from('bookings')
    .update({ status: 'cancelled', payment_status: 'failed' })
    .eq('id', bookingId)
    .eq('status', 'pending')
    .select()
    .single()
  return { data, error }
}

export async function cancelExpiredPendingBookings() {
  const now = new Date().toISOString()
  
  const { data, error } = await supabase
    .from('bookings')
    .update({ status: 'cancelled', payment_status: 'expired' })
    .eq('status', 'pending')
    .lt('payment_deadline', now)
    .select()

  if (data && data.length > 0) {
    console.log(`⏰ ${data.length} expired pending bookings cancelled`)
  }

  return { data, error }
}

export async function getPendingBooking(bookingId) {
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('id', bookingId)
    .single()
  return { data, error }
}
