// src/lib/price.js

/**
 * Calculate booking price based on duration
 * First 2 hours: Rp 50.000/hour
 * Additional hours: Rp 30.000/hour
 */
export function calculatePrice(duration) {
  if (duration <= 0) return 0
  if (duration <= 2) {
    return duration * 50000
  } else {
    return (2 * 50000) + ((duration - 2) * 30000)
  }
}

/**
 * Format price as Rupiah
 */
export function formatPrice(amount) {
  return 'Rp ' + amount.toLocaleString('id-ID')
}

/**
 * Calculate discount amount based on voucher type
 */
export function calculateDiscount(originalPrice, voucher) {
  if (!voucher) return 0

  if (voucher.discount_type === 'free') {
    return originalPrice - 1000  // Free = Rp 1000
  }

  if (voucher.discount_type === 'percentage') {
    return Math.round(originalPrice * (voucher.discount_value / 100))
  }

  if (voucher.discount_type === 'fixed') {
    return Math.min(originalPrice, voucher.discount_value)
  }

  return 0
}

/**
 * Calculate final price after discount
 */
export function calculateFinalPrice(originalPrice, voucher) {
  const discount = calculateDiscount(originalPrice, voucher)
  return Math.max(0, originalPrice - discount)
}
