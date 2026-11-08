import { useCallback, useEffect, useMemo, useState } from 'react'
import { FileText, RotateCcw, Eye } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'
import { TYPE_LABEL, artworkUrl, type EventType } from '../lib/events'
import { fmtDateTime } from '../lib/versions'
import { botPreview, describeSnapshot, type Snap } from '../lib/snapshot'
import { input, type Msg } from '../lib/ui'
import Modal from '../components/Modal'

type V = { id: string; seq: number; version_number: number; event_id: string; event_name: string; event_type: EventType; change_summary: string
  created_at: string; created_by_name: string | null; restored_from_version_id: string | null; artwork_path: string | null
  facets: { areas?: string[]; blocks?: string[]; lots?: number[] } }
type Open = { kind: 'print' | 'snapshot'; v: V; snap: Snap }

const lbl = 'mb-1 block text-xs font-semibold text-muted'
const PERIODS: [string, string][] = [['0', 'Todo o período'], ['7', 'Últimos 7 dias'], ['30', 'Últimos 30 dias'], ['90', 'Últimos 90 dias']]

export default function Historico() {
  const { profile } = useAuth()
  const isMaster = profile?.role === 'ADMIN_MASTER'
  const [list, setList] = useState<V[] | null>(null)
  const [ev, setEv] = useState(''); const [type, setType] = useState(''); const [period, setPeriod] = useState('0'); const [q, setQ] = useState('')
  const [open, setOpen] = useState<Open | null>(null)
  const [msg, setMsg] = useState<Msg>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('event_versions')
      .select('id,seq,version_number,event_id,event_name,event_type,change_summary,created_at,created_by_name,restored_from_version_id,artwork_path,facets')
      .order('seq', { ascending: false }).limit(300)
    if (error) return setMsg({ ok: false, text: 'Não foi possível carregar o histórico.' })
    setList((data ?? []) as V[])
  }, [])
  useEffect(() => { void load() }, [load])

  const events = useMemo(() => { const m = new Map<string, string>(); (list ?? []).forEach((v) => { if (!m.has(v.event_id)) m.set(v.event_id, v.event_name) }); return [...m] }, [list])
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase(); const digits = s.replace(/\D/g, ''); const since = period === '0' ? 0 : Date.now() - Number(period) * 86400000
    return (list ?? []).filter((v) => (!ev || v.event_id === ev) && (!type || v.event_type === type) && (!since || new Date(v.created_at).getTime() >= since)
      && (!s || [...(v.facets.areas ?? []), ...(v.facets.blocks ?? [])].some((n) => n.toLowerCase().includes(s)) || (digits !== '' && (v.facets.lots ?? []).includes(Number(digits)))))
  }, [list, ev, type, period, q])

  const view = async (v: V, kind: Open['kind']) => {
    setMsg(null); setBusy(v.id + kind)
    const { data, error } = await supabase.from('event_versions').select('snapshot').eq('id', v.id).single()
    setBusy(null)
    if (error || !data) return setMsg({ ok: false, text: 'Não foi possível abrir esta versão.' })
    setOpen({ kind, v, snap: (data as { snapshot: Snap }).snapshot })
  }

  const restore = async (v: V) => {
    if (!window.confirm(`Restaurar a versão #${v.seq} de "${v.event_name}"?\n\nO conteúdo atual do evento será substituído por esta versão e uma NOVA versão será criada. A versão antiga continua guardada no histórico.`)) return
    setMsg(null); setBusy(v.id + 'restore')
    const { data, error } = await supabase.rpc('restore_event_version', { p_version_id: v.id })
    setBusy(null)
    if (error) return setMsg({ ok: false, text: error.message || 'Não foi possível restaurar.' })
    const r = data as { created?: boolean; same?: boolean; seq?: number } | null
    setMsg({ ok: true, text: r?.same ? 'Esta já é a versão atual: nada foi alterado.' : `Versão #${v.seq} restaurada. Nova versão #${r?.seq} registrada.` })
    await load()
  }

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-extrabold">Histórico de atualizações</h1>
      <p className="mb-5 text-sm text-muted">Cada salvamento com alteração gera uma versão. As versões antigas nunca são alteradas.</p>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div><label className={lbl} htmlFor="f-ev">Evento</label>
          <select id="f-ev" className={input} value={ev} onChange={(e) => setEv(e.target.value)}><option value="">Todos</option>{events.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select></div>
        <div><label className={lbl} htmlFor="f-type">Tipo</label>
          <select id="f-type" className={input} value={type} onChange={(e) => setType(e.target.value)}><option value="">Todos</option>{(Object.keys(TYPE_LABEL) as EventType[]).map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}</select></div>
        <div><label className={lbl} htmlFor="f-per">Período</label>
          <select id="f-per" className={input} value={period} onChange={(e) => setPeriod(e.target.value)}>{PERIODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
        <div><label className={lbl} htmlFor="f-q">Área, bloco ou lote</label>
          <input id="f-q" className={input} value={q} placeholder="Ex.: Arena, Vumbora ou 3" onChange={(e) => setQ(e.target.value)} /></div>
      </div>

      {msg && <p role="status" className={`mb-3 rounded-lg px-3 py-2 text-sm ${msg.ok ? 'bg-mint/10 text-mint' : 'bg-alert/10 text-alert'}`}>{msg.text}</p>}
      {list === null && !msg && <p className="text-sm text-muted">Carregando...</p>}
      {list && !shown.length && <p className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">{list.length ? 'Nenhuma versão com esses filtros.' : 'Ainda não há versões. Salve um evento para registrar a primeira.'}</p>}

      <ul className="space-y-3">
        {shown.map((v) => {
          const img = artworkUrl(v.artwork_path)
          return (
            <li key={v.id} className="flex gap-3 rounded-2xl border border-line bg-surface p-3">
              {img ? <img src={img} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" /> : <div className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-bg text-muted"><FileText /></div>}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2"><span className="font-extrabold text-brand-soft">#{v.seq}</span><span className="truncate font-bold">{v.event_name}</span>
                  <span className="text-xs text-muted">v{v.version_number} • {TYPE_LABEL[v.event_type]}</span></div>
                <div className="text-sm">{v.change_summary}{v.restored_from_version_id && <span className="ml-2 rounded-full bg-sun/15 px-2 py-0.5 text-xs text-sun">restauração</span>}</div>
                <div className="text-xs text-muted">{fmtDateTime(v.created_at)} • {v.created_by_name ?? 'Usuário removido'}</div>
                <div className="mt-2 flex flex-wrap gap-2 text-sm">
                  <button type="button" disabled={busy !== null} onClick={() => void view(v, 'print')} className="flex items-center gap-1 rounded-lg border border-line px-3 py-1 font-semibold hover:border-brand"><Eye size={14} />Ver print</button>
                  <button type="button" disabled={busy !== null} onClick={() => void view(v, 'snapshot')} className="flex items-center gap-1 rounded-lg border border-line px-3 py-1 font-semibold hover:border-brand"><FileText size={14} />Ver snapshot</button>
                  {isMaster && <button type="button" disabled={busy !== null} onClick={() => void restore(v)} className="flex items-center gap-1 rounded-lg border border-sun/50 px-3 py-1 font-semibold text-sun hover:bg-sun/10"><RotateCcw size={14} />Restaurar</button>}
                </div>
              </div>
            </li>
          )
        })}
      </ul>
      {list && list.length >= 300 && <p className="mt-3 text-xs text-muted">Mostrando as 300 versões mais recentes.</p>}

      {open?.kind === 'print' && (() => { const p = botPreview(open.snap); const img = artworkUrl(p.artwork); return (
        <Modal title={`Print da versão #${open.v.seq}`} onClose={() => setOpen(null)}>
          <p className="mb-3 text-xs text-muted">Como esta versão aparece no bot, montado só com os dados daquela versão. {fmtDateTime(open.v.created_at)}</p>
          <div className="mx-auto max-w-sm rounded-2xl bg-[#0b141a] p-3">
            <div className="rounded-xl bg-[#202c33] p-3 text-sm text-white">
              {img && <img src={img} alt="Arte do evento" className="mb-2 w-full rounded-lg" />}
              <pre className="whitespace-pre-wrap font-sans">{p.lines.join('\n')}</pre>
            </div>
          </div>
        </Modal>) })()}

      {open?.kind === 'snapshot' && (
        <Modal title={`Snapshot da versão #${open.v.seq}`} onClose={() => setOpen(null)}>
          <p className="mb-3 text-xs text-muted">Conteúdo guardado em {fmtDateTime(open.v.created_at)}. Esta cópia é imutável.</p>
          <div className="space-y-4">
            {describeSnapshot(open.snap).map((s) => (
              <section key={s.title}><h3 className="mb-1 text-sm font-bold text-brand-soft">{s.title}</h3>
                <ul className="space-y-0.5 text-sm">{s.lines.map((l, i) => <li key={i} className="whitespace-pre-wrap">{l}</li>)}</ul></section>
            ))}
            <details className="text-xs"><summary className="cursor-pointer text-muted">Ver dados completos (JSON)</summary>
              <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-bg p-3">{JSON.stringify(open.snap, null, 2)}</pre></details>
          </div>
        </Modal>
      )}
    </div>
  )
}
