import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, supabaseConfigured } from '../lib/supabase'

export type Profile = {
  name: string
  role: 'ADMIN_MASTER' | 'ADMIN'
  active: boolean
  can_publish: boolean
}

type Ctx = {
  session: Session | null
  profile: Profile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
}

const AuthCtx = createContext<Ctx>(null!)
export const useAuth = () => useContext(AuthCtx)

// Busca o perfil. Antes da etapa B03 a tabela não existe: nesse caso segue sem perfil.
async function loadProfile(userId: string): Promise<{ profile: Profile | null; blocked: boolean }> {
  const { data, error } = await supabase
    .from('profiles')
    .select('name, role, active, can_publish')
    .eq('user_id', userId)
    .maybeSingle()
  if (error || !data) return { profile: null, blocked: false }
  return { profile: data as Profile, blocked: !data.active }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabaseConfigured) { setLoading(false); return }
    const apply = async (s: Session | null) => {
      if (s) {
        const { profile, blocked } = await loadProfile(s.user.id)
        if (blocked) { await supabase.auth.signOut(); setSession(null); setProfile(null); return }
        setProfile(profile)
      } else setProfile(null)
      setSession(s)
    }
    supabase.auth.getSession().then(({ data }) => apply(data.session)).finally(() => setLoading(false))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => { void apply(s) })
    return () => sub.subscription.unsubscribe()
  }, [])

  const signIn: Ctx['signIn'] = async (email, password) => {
    if (!supabaseConfigured) return 'Supabase não configurado. Veja o arquivo .env.example.'
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return 'E-mail ou senha inválidos.'
    const { blocked } = await loadProfile(data.user.id)
    if (blocked) { await supabase.auth.signOut(); return 'Usuário inativo. Fale com o administrador Master.' }
    return null
  }

  const signOut = async () => { await supabase.auth.signOut() }

  return <AuthCtx.Provider value={{ session, profile, loading, signIn, signOut }}>{children}</AuthCtx.Provider>
}
