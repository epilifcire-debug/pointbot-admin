import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { Eye, EyeOff, Lock, Mail } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'

export default function Login() {
  const { session, loading, signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!loading && session) return <Navigate to="/" replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true); setError(null)
    setError(await signIn(email.trim(), password))
    setBusy(false)
  }

  const field = 'w-full rounded-xl border border-line bg-surface py-3 pl-11 pr-11 text-sm outline-none focus:border-brand'

  return (
    <div className="relative grid min-h-full place-items-center overflow-hidden p-6">
      {/* fundo leve em CSS (sem biblioteca), seguindo o preset roxo do padrão EFCSYS */}
      <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-brand/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 -right-16 h-72 w-72 rounded-full bg-mint/20 blur-3xl" />

      <form onSubmit={submit} className="relative w-full max-w-sm space-y-4">
        <div className="mb-6 text-center">
          <img src="./logo.png" alt="PointBot" className="mx-auto mb-3 h-24 w-24 rounded-full" />
          <h1 className="text-2xl font-extrabold">PointBot</h1>
          <p className="text-sm text-muted">Gestão de Eventos • Point do Ingresso</p>
        </div>

        <label className="relative block">
          <span className="sr-only">E-mail</span>
          <Mail className="absolute left-3.5 top-3.5 text-muted" size={18} />
          <input type="email" required autoComplete="username" placeholder="E-mail" value={email}
            onChange={(e) => setEmail(e.target.value)} className={field} />
        </label>

        <label className="relative block">
          <span className="sr-only">Senha</span>
          <Lock className="absolute left-3.5 top-3.5 text-muted" size={18} />
          <input type={show ? 'text' : 'password'} required autoComplete="current-password" placeholder="Senha"
            value={password} onChange={(e) => setPassword(e.target.value)} className={field} />
          <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Ocultar senha' : 'Mostrar senha'}
            className="absolute right-3.5 top-3.5 text-muted">{show ? <EyeOff size={18} /> : <Eye size={18} />}</button>
        </label>

        {error && <p role="alert" className="rounded-lg bg-alert/10 px-3 py-2 text-sm text-alert">{error}</p>}

        <button disabled={busy} className="w-full rounded-xl bg-brand py-3 font-bold transition-colors hover:bg-brand-soft disabled:opacity-60">
          {busy ? 'Entrando...' : 'Entrar'}
        </button>
        <p className="text-center text-xs text-muted">Acesso restrito a administradores autorizados.<br />Desenvolvido por <b className="text-white">efcsys</b></p>
      </form>
    </div>
  )
}
