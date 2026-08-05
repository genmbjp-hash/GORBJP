// src/hooks/useAuth.js

// Re-exported for backwards compatibility with existing imports
// (e.g. src/components/admin/Admin.jsx). The actual implementation now
// lives in a single shared AuthContext so the whole app uses one
// onAuthStateChange listener instead of multiple competing ones.
export { useAuth } from '../contexts/AuthContext'
