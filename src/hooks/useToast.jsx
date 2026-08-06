// Re-exported for backwards compatibility with existing imports across the
// app (CheckoutSheet, PaymentSheet, Admin*, etc). The actual implementation
// now lives in a single shared ToastContext so there's exactly one toast
// system, and its container is actually mounted (see main.jsx) instead of
// silently rendering into nothing.
export { useToast } from '../contexts/ToastContext'
