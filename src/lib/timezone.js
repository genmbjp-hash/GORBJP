// src/lib/timezone.js

/**
 * Get current time in WIB timezone (UTC+7) as ISO string
 */
export function getWIBTime() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  const seconds = String(now.getSeconds()).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}+07:00`
}

/**
 * Format date as WIB date string (YYYY-MM-DD)
 */
export function getWIBDateString(date) {
  if (!date) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Format date as WIB datetime string (YYYY-MM-DD HH:MM:SS+07:00)
 */
export function getWIBDateTimeString(date, hour, minute = 0, second = 0) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(hour).padStart(2, '0')
  const minutes = String(minute).padStart(2, '0')
  const seconds = String(second).padStart(2, '0')
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}+07:00`
}

/**
 * Get WIB date range for a given date
 */
export function getWIBDateRange(dateObj) {
  const year = dateObj.getFullYear()
  const month = String(dateObj.getMonth() + 1).padStart(2, '0')
  const day = String(dateObj.getDate()).padStart(2, '0')
  return {
    start: `${year}-${month}-${day} 00:00:00+07:00`,
    end: `${year}-${month}-${day} 23:59:59+07:00`
  }
}
