import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useAuth() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    let mounted = true

    async function loadProfile(userId) {
      if (!userId) {
        if (mounted) setLoading(false)
        return
      }

      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (mounted) {
        setProfile(data)
        setIsAdmin(data?.role === 'admin')
        setLoading(false)
      }
    }

    // onAuthStateChange fires once immediately on subscribe with the current
    // session (event: 'INITIAL_SESSION'), so a separate getSession() call on
    // mount is redundant — this listener alone covers first load + every
    // future sign-in/sign-out/token-refresh.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      // IMPORTANT: never await/call back into supabase.* directly inside this
      // callback. GoTrueClient holds an internal lock while this callback
      // runs, and it uses postMessage/storage events to sync auth state
      // across tabs. Calling supabase.from(...) synchronously here can
      // re-trigger that sync machinery and re-fire this callback before the
      // previous run finishes — causing an infinite postMessage loop
      // ("Throttling navigation to prevent the browser from hanging").
      // Deferring with setTimeout lets the callback return and release the
      // lock before we touch Supabase again.
      setTimeout(() => {
        if (!mounted) return

        if (session?.user) {
          setUser(session.user)
          loadProfile(session.user.id)
        } else {
          setUser(null)
          setProfile(null)
          setIsAdmin(false)
          setLoading(false)
        }
      }, 0)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    setIsAdmin(false)
  }

  return {
    user,
    profile,
    loading,
    isAdmin,
    signOut,
  }
}
