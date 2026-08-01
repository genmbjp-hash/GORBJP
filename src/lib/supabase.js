import { createClient } from '@supabase/supabase-js'

// ============================================
// SUPABASE CREDENTIALS
// ============================================
const SUPABASE_URL = 'https://ehbmfgzkbxxdmknhasea.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVoYm1mZ3prYnh4ZG1rbmhhc2VhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU0Nzk3NDUsImV4cCI6MjEwMTA1NTc0NX0.n1cgSLaAEqUG3nF57yYepNeTx6VNd9OlT7BmODR4-JE'

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
  return { data, error }
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  })
  return { data, error }
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  return { error }
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser()
  return user
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
// BOOKING FUNCTIONS
// ============================================

export async function checkAvailability(date, startTime, durationHours = 2) {
  const startDateTime = new Date(`${date}T${startTime}`)
  const endDateTime = new Date(startDateTime.getTime() + durationHours * 60 * 60 * 1000)

  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .or(`status.eq.pending,status.eq.active`)
    .filter('start_time', 'lt', endDateTime.toISOString())
    .filter('end_time', 'gt', startDateTime.toISOString())

  if (error) return { available: false, error }
  return { available: data.length === 0, data }
}

export async function createBooking(userId, date, startTime, durationHours = 2) {
  const startDateTime = new Date(`${date}T${startTime}`)
  const endDateTime = new Date(startDateTime.getTime() + durationHours * 60 * 60 * 1000)

  const { data: pinData, error: pinError } = await supabase.rpc('generate_pin')
  if (pinError) return { error: pinError }

  const { data, error } = await supabase
    .from('bookings')
    .insert({
      user_id: userId,
      pin: pinData,
      start_time: startDateTime.toISOString(),
      end_time: endDateTime.toISOString(),
      duration_hours: durationHours,
      price: 0,
      payment_status: 'free',
      payment_method: 'free',
      status: 'pending'
    })
    .select()
    .single()

  if (!error) {
    await supabase
      .from('activity_logs')
      .insert({
        user_id: userId,
        event: 'booking_created',
        pin: pinData,
        details: { start_time: startDateTime.toISOString(), end_time: endDateTime.toISOString() }
      })
  }

  return { data, error }
}

// ============================================
// CHECKOUT + TELEGRAM NOTIFICATION
// ============================================

export async function sendTelegramNotification(booking, profile) {
  try {
    console.log('📤 Sending Telegram notification...')
    console.log('📤 Booking PIN:', booking?.pin)
    console.log('📤 Profile email:', profile?.email)
    
    const { data, error } = await supabase.functions.invoke('send-telegram', {
      body: { booking, profile }
    })
    
    if (error) {
      console.error('❌ Telegram invoke error:', error)
      return { error }
    }
    
    console.log('✅ Telegram response:', data)
    return { data }
    
  } catch (error) {
    console.error('❌ Telegram catch error:', error.message)
    return { error }
  }
}

export async function createBookingWithCheckout(userId, slotData, duration) {
  const { date, hour } = slotData
  const startDateTime = new Date(date)
  startDateTime.setHours(hour, 0, 0, 0)
  
  const endDateTime = new Date(startDateTime)
  endDateTime.setHours(hour + duration, 0, 0, 0)

  // Check for overlaps
  const { data: existingBookings, error: checkError } = await supabase
    .from('bookings')
    .select('*')
    .or(`status.eq.pending,status.eq.active`)
    .filter('start_time', 'lt', endDateTime.toISOString())
    .filter('end_time', 'gt', startDateTime.toISOString())

  if (checkError) return { error: checkError }
  if (existingBookings.length > 0) {
    return { error: { message: 'Slot sudah dibooking oleh orang lain' } }
  }

  // Generate PIN
  const { data: pinData, error: pinError } = await supabase.rpc('generate_pin')
  if (pinError) return { error: pinError }

  // Create booking
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

  if (error) return { error }

  // ============================================
  // SEND TELEGRAM NOTIFICATION (FIXED)
  // ============================================
  try {
    console.log('📤 Getting profile for user:', userId)
    
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (profileError) {
      console.error('❌ Profile fetch error:', profileError)
    } else if (profile) {
      console.log('✅ Profile found:', profile.email)
      
      // ✅ USE THE CORRECT FUNCTION CALL
      const { error: invokeError } = await supabase.functions.invoke('send-telegram', {
        body: { booking: data, profile }
      })
      
      if (invokeError) {
        console.error('❌ Telegram invoke error:', invokeError)
      } else {
        console.log('✅ Telegram sent successfully!')
      }
    }
  } catch (err) {
    console.error('❌ Telegram error:', err.message)
  }

  return { data, error }
}

// ============================================
// GET BOOKINGS
// ============================================

export async function getUserBookings(userId) {
  const { data, error } = await supabase
    .from('bookings')
    .select('*')
    .eq('user_id', userId)
    .order('start_time', { ascending: true })
  return { data, error }
}

export async function getAllBookings() {
  const { data, error } = await supabase
    .from('bookings')
    .select('*, profiles(full_name, display_name, email, phone, block, house_number)')
    .order('start_time', { ascending: false })
  return { data, error }
}

export async function getBookingsForDate(date) {
  const startDate = new Date(date)
  startDate.setHours(0, 0, 0, 0)
  
  const endDate = new Date(date)
  endDate.setHours(23, 59, 59, 999)

  const { data, error } = await supabase
    .from('bookings')
    .select(`
      *,
      profiles(full_name, display_name)
    `)
    .gte('start_time', startDate.toISOString())
    .lte('start_time', endDate.toISOString())
    .or(`status.eq.pending,status.eq.active,status.eq.completed`)

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

  if (!error) {
    await supabase
      .from('activity_logs')
      .insert({
        user_id: userId,
        event: 'booking_cancelled',
        details: { booking_id: bookingId }
      })
  }
  return { data, error }
}

// ============================================
// ADMIN FUNCTIONS
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
    .update({
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: adminId
    })
    .eq('id', userId)
    .select()
    .single()

  if (!error) {
    await supabase
      .from('activity_logs')
      .insert({
        user_id: adminId,
        event: 'user_approved',
        details: { user_id: userId }
      })
  }
  return { data, error }
}

export async function rejectUser(userId, adminId) {
  const { data, error } = await supabase
    .from('profiles')
    .update({
      status: 'rejected',
      approved_at: new Date().toISOString(),
      approved_by: adminId
    })
    .eq('id', userId)
    .select()
    .single()

  if (!error) {
    await supabase
      .from('activity_logs')
      .insert({
        user_id: adminId,
        event: 'user_rejected',
        details: { user_id: userId }
      })
  }
  return { data, error }
}

// ============================================
// MASTER PIN FUNCTIONS
// ============================================

export async function generateMasterPin(adminId, durationMinutes, purpose = '') {
  const pin = String(Math.floor(1000 + Math.random() * 9000))
  const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000)

  const { data, error } = await supabase
    .from('master_pins')
    .insert({
      pin: pin,
      duration_minutes: durationMinutes,
      purpose: purpose,
      generated_by: adminId,
      expires_at: expiresAt.toISOString(),
      active: true
    })
    .select()
    .single()

  if (!error) {
    await supabase
      .from('activity_logs')
      .insert({
        user_id: adminId,
        event: 'master_pin_generated',
        pin: pin,
        details: { duration: durationMinutes, purpose, expires_at: expiresAt.toISOString() }
      })
  }
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

  if (!error) {
    await supabase
      .from('activity_logs')
      .insert({
        user_id: adminId,
        event: 'master_pin_deactivated',
        details: { pin_id: pinId }
      })
  }
  return { data, error }
}

// ============================================
// DEVICE FUNCTIONS
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
    result = await supabase
      .from('device_status')
      .insert({
        device_mac: 'AA:BB:CC:DD:EE:FF',
        relay_state: true,
        master_mode: false,
        last_seen: new Date().toISOString()
      })
      .select()
      .single()
  } else {
    result = await supabase
      .from('device_status')
      .update({
        relay_state: true,
        last_seen: new Date().toISOString()
      })
      .eq('device_mac', 'AA:BB:CC:DD:EE:FF')
      .select()
      .maybeSingle()
  }
  
  if (!result.error) {
    await supabase
      .from('activity_logs')
      .insert({
        user_id: adminId,
        event: 'force_lamp_on'
      })
  }
  
  return result
}

export async function forceLampOff(adminId) {
  const { data: existing } = await getDeviceStatus()
  
  let result
  if (!existing) {
    result = await supabase
      .from('device_status')
      .insert({
        device_mac: 'AA:BB:CC:DD:EE:FF',
        relay_state: false,
        master_mode: false,
        last_seen: new Date().toISOString()
      })
      .select()
      .single()
  } else {
    result = await supabase
      .from('device_status')
      .update({
        relay_state: false,
        last_seen: new Date().toISOString()
      })
      .eq('device_mac', 'AA:BB:CC:DD:EE:FF')
      .select()
      .maybeSingle()
  }
  
  if (!result.error) {
    await supabase
      .from('activity_logs')
      .insert({
        user_id: adminId,
        event: 'force_lamp_off'
      })
  }
  
  return result
}

// ============================================
// ACTIVITY LOGS
// ============================================

export async function logActivity(userId, event, pin = null, details = null) {
  const { error } = await supabase
    .from('activity_logs')
    .insert({
      user_id: userId,
      event: event,
      pin: pin,
      details: details
    })
  return { error }
}

// ============================================
// CHECK ADMIN
// ============================================

export async function isAdmin(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()
  if (error || !data) return false
  return data.role === 'admin'
}
