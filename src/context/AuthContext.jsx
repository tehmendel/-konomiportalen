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
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false)
  const [impersonating, setImpersonating] = useState(null) // { userId, fullName, householdId, householdName, avatarUrl, role }
  const [impersonatedMembers, setImpersonatedMembers] = useState([])

  const refreshMfaLevel = useCallback(async () => {
    const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    setMfaLevel({ current: data?.currentLevel ?? null, next: data?.nextLevel ?? null })
  }, [])

  // household_members.user_id and profiles.id both reference auth.users(id)
  // independently, so PostgREST can't embed profiles directly — fetch and merge instead.
  const fetchHouseholdMembers = useCallback(async (householdId) => {
    const { data: memberRows } = await supabase
      .from('household_members')
      .select('user_id, role')
      .eq('household_id', householdId)

    const memberIds = (memberRows || []).map((m) => m.user_id)
    const { data: memberProfiles } = memberIds.length
      ? await supabase.from('profiles').select('id, full_name').in('id', memberIds)
      : { data: [] }
    const profileById = Object.fromEntries((memberProfiles || []).map((p) => [p.id, p]))

    return (memberRows || []).map((m) => ({ ...m, profiles: profileById[m.user_id] || null }))
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

    setMembers(await fetchHouseholdMembers(membership.household_id))
  }, [fetchHouseholdMembers])

  const loadProfile = useCallback(async (userId) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
    setProfile(data)
  }, [])

  const checkPlatformAdmin = useCallback(async () => {
    const { data } = await supabase.rpc('is_platform_admin')
    setIsPlatformAdmin(Boolean(data))
  }, [])

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!active) return
      setSession(session)
      if (session?.user) {
        await Promise.all([loadProfile(session.user.id), loadHousehold(session.user.id), refreshMfaLevel(), checkPlatformAdmin()])
      }
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session)
      if (session?.user) {
        await Promise.all([loadProfile(session.user.id), loadHousehold(session.user.id), refreshMfaLevel(), checkPlatformAdmin()])
      } else {
        setProfile(null)
        setHousehold(null)
        setMembers([])
        setMfaLevel({ current: null, next: null })
        setIsPlatformAdmin(false)
        setImpersonating(null)
        setImpersonatedMembers([])
      }
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [loadProfile, loadHousehold, refreshMfaLevel, checkPlatformAdmin])

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

  // Platform-admin "se som"-modus: leser data på tvers av husstander via de
  // egne admin_read_*-policyene (samme ekte økt hele veien, aldri en ny
  // innlogging) — se ikke skriv, siden det ikke finnes tilsvarende
  // admin-skrivepolicyer. Ethvert forsøk på å lagre noe mens man "ser som"
  // noen andre blokkeres derfor av RLS uansett hva klienten sender.
  async function startImpersonation(targetUserId) {
    if (!isPlatformAdmin) throw new Error('Krever platform-admin-rolle')

    const { data: targetProfile } = await supabase.from('profiles').select('id, full_name').eq('id', targetUserId).maybeSingle()
    const { data: membership } = await supabase
      .from('household_members')
      .select('household_id, role, households(id, name, avatar_url)')
      .eq('user_id', targetUserId)
      .maybeSingle()

    if (!targetProfile || !membership) throw new Error('Fant ikke brukeren eller husstanden')

    await supabase.from('admin_impersonation_log').insert({
      admin_user_id: session.user.id,
      target_user_id: targetUserId,
      target_household_id: membership.household_id,
    })

    setImpersonatedMembers(await fetchHouseholdMembers(membership.household_id))
    setImpersonating({
      userId: targetProfile.id,
      fullName: targetProfile.full_name,
      householdId: membership.household_id,
      householdName: membership.households?.name,
      avatarUrl: membership.households?.avatar_url,
      role: membership.role,
    })
  }

  function stopImpersonation() {
    setImpersonating(null)
    setImpersonatedMembers([])
  }

  const effectiveUser = impersonating ? { id: impersonating.userId } : (session?.user ?? null)
  const effectiveProfile = impersonating ? { id: impersonating.userId, full_name: impersonating.fullName } : profile
  const effectiveHousehold = impersonating
    ? { id: impersonating.householdId, name: impersonating.householdName, avatarUrl: impersonating.avatarUrl, role: impersonating.role }
    : household
  const effectiveMembers = impersonating ? impersonatedMembers : members

  const value = {
    session,
    user: effectiveUser,
    profile: effectiveProfile,
    household: effectiveHousehold,
    members: effectiveMembers,
    loading,
    mfaLevel,
    refreshMfaLevel,
    signIn,
    signUp,
    requestPasswordReset,
    updatePassword,
    signOut,
    refreshHousehold,
    isPlatformAdmin,
    impersonating,
    startImpersonation,
    stopImpersonation,
    realUser: session?.user ?? null,
    realProfile: profile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth må brukes inne i AuthProvider')
  return ctx
}
