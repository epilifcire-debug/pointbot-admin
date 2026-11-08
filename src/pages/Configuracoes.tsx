import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { KeyRound, ShieldCheck } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'
import { AttendanceForm, SupportForm } from '../components/BotSettings'

type Row = { user_id: string; name: string; email: string; role: 'ADMIN_MASTER' | 'ADMIN'; active: boolean; can_publish: boolean }

async function call(body: Record<string, unknown>): Promise<string | null> {
  const { error } = await supabase.functions.invoke('admin-users', { body })
  if (!error) return null
  try { return (await (error as unknown as { context: Response }).context.json()).error ?? 'Falha na operação.' }
  catch { return 'Falha na operação.' }
}

const input = 'w-full rounded-xl border border-line bg-bg px-3 py-2.5 text-sm outline-none focus:border-brand'

function Administradores() {
  const { profile } = useAuth()
  const [rows, setRows] = useState<Row[]>([])
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [f, setF] = useState({ name: '', email: '', password: '', can_publish: false })
  const isMaster = profile?.role === 'ADMIN_MASTER'

  const load = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('user_id,name,email,role,active,can_publish').order('created_at')
    setRows((data as Row[]) ?? [])
  }, [])
  useEffect(() => { if (isMaster) void load() }, [isMaster, load])

  const run = async (body: Record<string, unknown>, okText: string) => {
    setBusy(true); setMsg(null)
    const err = await call(body)
    setMsg(err ? { ok: false, text: err } : { ok: true, text: okText })
    setBusy(false)
    if (!err) await load()
    return !err
  }

  const create = async (e: FormEvent) => {
    e.preventDefault()
    if (await run({ action: 'create', ...f, active: true }, 'Administrador criado.')) setF({ name: '', email: '', password: '', can_publish: false })
  }

  return (
    <div>

      {msg && <p role="status" className={`mb-4 rounded-lg px-3 py-2 text-sm ${msg.ok ? 'bg-mint/10 text-mint' : 'bg-alert/10 text-alert'}`}>{msg.text}</p>}

      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.user_id} className="rounded-2xl border border-line bg-surface p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2 font-bold">{r.name}
                  {r.role === 'ADMIN_MASTER' && <span className="flex items-center gap-1 rounded-full bg-brand/20 px-2 py-0.5 text-xs text-brand-soft"><ShieldCheck size={12} />Master</span>}
                </div>
                <div className="truncate text-xs text-muted">{r.email}</div>
              </div>
              {r.role === 'ADMIN' && (
                <div className="flex flex-wrap items-center gap-4 text-sm">
                  <label className="flex items-center gap-2"><input type="checkbox" checked={r.can_publish} disabled={busy}
                    onChange={(e) => run({ action: 'update', user_id: r.user_id, can_publish: e.target.checked }, 'Permissão atualizada.')} />Pode publicar</label>
                  <label className="flex items-center gap-2"><input type="checkbox" checked={r.active} disabled={busy}
                    onChange={(e) => run({ action: 'update', user_id: r.user_id, active: e.target.checked }, r.active ? 'Administrador desativado.' : 'Administrador ativado.')} />Ativo</label>
                  <button disabled={busy} className="flex items-center gap-1 text-muted hover:text-white" onClick={() => {
                    const p = window.prompt('Nova senha (mínimo 10 caracteres):')
                    if (p) void run({ action: 'reset_password', user_id: r.user_id, password: p }, 'Senha alterada.')
                  }}><KeyRound size={14} />Nova senha</button>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>

      <form onSubmit={create} className="mt-6 space-y-3 rounded-2xl border border-line bg-surface p-4">
        <h2 className="font-bold">Novo administrador</h2>
        <input className={input} placeholder="Nome" required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <input className={input} type="email" placeholder="E-mail" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
        <input className={input} type="password" minLength={10} placeholder="Senha inicial (mínimo 10 caracteres)" required autoComplete="new-password"
          value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.can_publish} onChange={(e) => setF({ ...f, can_publish: e.target.checked })} />Pode publicar no bot</label>
        <button disabled={busy} className="rounded-xl bg-brand px-4 py-2.5 text-sm font-bold hover:bg-brand-soft disabled:opacity-60">Criar administrador</button>
      </form>
    </div>
  )
}

const TABS = [['admins', 'Administradores'], ['atendimento', 'Atendimento'], ['suporte', 'Suporte Compras Online']] as const

export default function Configuracoes() {
  const { profile } = useAuth()
  const [tab, setTab] = useState<(typeof TABS)[number][0]>('admins')
  if (profile?.role !== 'ADMIN_MASTER') return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-extrabold">Configurações</h1>
      <p className="mt-3 rounded-2xl border border-dashed border-line p-6 text-sm text-muted">Somente o administrador Master gerencia administradores, atendimento e suporte.</p>
    </div>
  )
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-extrabold">Configurações</h1>
      <p className="mb-4 text-sm text-muted">Somente o administrador Master vê esta área.</p>
      <div className="mb-5 flex gap-2 overflow-x-auto" role="tablist">
        {TABS.map(([k, l]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold ${tab === k ? 'bg-brand text-white' : 'bg-surface text-muted hover:text-white'}`}>{l}</button>
        ))}
      </div>
      {tab === 'admins' && <Administradores />}
      {tab === 'atendimento' && <AttendanceForm />}
      {tab === 'suporte' && <SupportForm />}
    </div>
  )
}
