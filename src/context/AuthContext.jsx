import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [household, setHousehold] = useState(null)
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [mfaLevel, setMfaLevel] = useState({ current: null, next: null })

  const refreshMfaLevel = useCallback(async () => {
    const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    setMfaLevel({ current: data?.currentLevel ?? null, next: data?.nextLevel ?? null })
  }, [])

  const loadHousehold = useCallback(async (userId) => {
    const { data: membership } = await supabase
      .from('household_members')
      .select('household_id, role, households(id, name, avatar_url)')
      .eq('user_id', userId)
      .maybeSingle()

    if (!membership) {
      setHousehold(null)
      setMembers([])
      return
    }

    setHousehold({
      id: membership.household_id,
      name: membership.households?.name,
      avatarUrl: membership.households?.avatar_url,
      role: membership.role,
    })

    // household_members.user_id and profiles.id both reference auth.users(id)
    // independently, so PostgREST can't embed profiles directly — fetch and merge instead.
    const { data: memberRows } = await supabase
      .from('household_members')
      .select('user_id, role')
      .eq('household_id', membership.household_id)

    const memberIds = (memberRows || []).map((m) => m.user_id)
    const { data: memberProfiles } = memberIds.length
      ? await supabase.from('profiles').select('id, full_name').in('id', memberIds)
      : { data: [] }
    const profileById = Object.fromEntries((memberProfiles || []).map((p) => [p.id, p]))

    setMembers((memberRows || []).map((m) => ({ ...m, profiles: profileById[m.user_id] || null })))
  }, [])

  const loadProfile = useCallback(async (userId) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
    setProfile(data)
  }, [])

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!active) return
      setSession(session)
      if (session?.user) {
        await Promise.all([loadProfile(session.user.id), loadHousehold(session.user.id), refreshMfaLevel()])
      }
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session)
      if (session?.user) {
        await Promise.all([loadProfile(session.user.id), loadHousehold(session.user.id), refreshMfaLevel()])
      } else {
        setProfile(null)
        setHousehold(null)
        setMembers([])
        setMfaLevel({ current: null, next: null })
      }
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [loadProfile, loadHousehold, refreshMfaLevel])

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  async function signUp(email, password) {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin + import.meta.env.BASE_URL },
    })
    if (error) throw error
  }

  async function requestPasswordReset(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + import.meta.env.BASE_URL + 'tilbakestill-passord',
    })
    if (error) throw error
  }

  async function updatePassword(newPassword) {
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) throw error
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  async function refreshHousehold() {
    if (session?.user) await loadHousehold(session.user.id)
  }

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    household,
    members,
    loading,
    mfaLevel,
    refreshMfaLevel,
    signIn,
    signUp,
    requestPasswordReset,
    updatePassword,
    signOut,
    refreshHousehold,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth må brukes inne i AuthProvider')
  return ctx
}
