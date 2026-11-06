import { useCallback, useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, Copy, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'

type Cat = 'MEIA' | 'SOLIDARIA' | 'INTEIRA' | 'CASADINHA' | 'CUSTOM'
type TDraft = { key: string; id?: string; name: string; category: Cat; qty: number; price: string }
type NDraft = { key: string; id?: string; name: string }
type Day = { id: string; event_date: string }
type Msg = { ok: boolean; text: string } | null

const uid = () => crypto.randomUUID()
const WEEK = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const STD: [string, Cat][] = [['Meia Entrada', 'MEIA'], ['Entrada Solidária', 'SOLIDARIA'], ['Inteira', 'INTEIRA']]
const STATUS: [string, string][] = [['ON_SALE', 'À venda'], ['SOLD_OUT', 'Esgotado'], ['HIDDEN', 'Oculto']]
const input = 'w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-brand'

const dayLabel = (d: string) => { const [y, m, dd] = d.split('-').map(Number); return `${WEEK[new Date(y, m - 1, dd).getDay()]} ${String(dd).padStart(2, '0')}/${String(m).padStart(2, '0')}` }
const fmtPrice = (a: number | string) => Number(a).toFixed(2).replace('.', ',')
function parsePrice(s: string): number | null | 'bad' {
  const t = s.trim().replace(/^R\$\s*/, '')
  if (!t) return null
  const n = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t
  return /^\d+(\.\d{1,2})?$/.test(n) ? Number(n) : 'bad'
}
const move = <T,>(l: T[], i: number, d: number) => { const j = i + d; if (j < 0 || j >= l.length) return l; const c = [...l]; [c[i], c[j]] = [c[j], c[i]]; return c }

function NameList({ title, hint, items, onChange, add }: { title: string; hint?: string; items: NDraft[]; onChange: (l: NDraft[]) => void; add: string }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-sm font-bold">{title}</h4>
        <button type="button" onClick={() => onChange([...items, { key: uid(), name: '' }])} className="flex items-center gap-1 text-sm font-semibold text-brand-soft"><Plus size={14} />{add}</button>
      </div>
      {hint && !items.length && <p className="text-xs text-muted">{hint}</p>}
      <ul className="space-y-2">
        {items.map((it, i) => (
          <li key={it.key} className="flex items-center gap-1">
            <input className={input} value={it.name} placeholder="Nome" aria-label={title} onChange={(e) => onChange(items.map((x) => x.key === it.key ? { ...x, name: e.target.value } : x))} />
            <button type="button" aria-label="Subir" onClick={() => onChange(move(items, i, -1))} className="p-1 text-muted hover:text-white"><ArrowUp size={16} /></button>
            <button type="button" aria-label="Descer" onClick={() => onChange(move(items, i, 1))} className="p-1 text-muted hover:text-white"><ArrowDown size={16} /></button>
            <button type="button" aria-label="Remover" onClick={() => onChange(items.filter((x) => x.key !== it.key))} className="p-1 text-muted hover:text-alert"><Trash2 size={16} /></button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function DayEditor({ day, reloadKey, onDirty, onCopy }: { day: Day; reloadKey: number; onDirty: (d: boolean) => void; onCopy: () => void }) {
  const [lot, setLot] = useState('')
  const [status, setStatus] = useState('ON_SALE')
  const [types, setTypes] = useState<TDraft[]>([])
  const [artists, setArtists] = useState<NDraft[]>([])
  const [guests, setGuests] = useState<NDraft[]>([])
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<Msg>(null)

  const touch = useCallback(() => onDirty(true), [onDirty])

  const load = useCallback(async () => {
    const [d, t, a] = await Promise.all([
      supabase.from('event_dates').select('current_lot,status').eq('id', day.id).single(),
      supabase.from('ticket_types').select('id,name,category,quantity_per_purchase,sort_order,ticket_prices(amount,active)').eq('event_date_id', day.id).is('area_id', null).order('sort_order'),
      supabase.from('event_artists').select('id,participation_type,sort_order,artists(name)').eq('event_date_id', day.id).order('sort_order'),
    ])
    if (d.error || t.error || a.error) { setMsg({ ok: false, text: 'Não foi possível carregar este dia.' }); return }
    setLot(d.data?.current_lot ? String(d.data.current_lot) : ''); setStatus(d.data?.status ?? 'ON_SALE')
    setTypes((t.data ?? []).map((r: any) => {
      const p = (r.ticket_prices ?? []).find((x: any) => x.active)
      return { key: r.id, id: r.id, name: r.name, category: r.category, qty: r.quantity_per_purchase, price: p ? fmtPrice(p.amount) : '' }
    }))
    const names = (kind: string) => (a.data ?? []).filter((r: any) => r.participation_type === kind).map((r: any) => ({ key: r.id, id: r.id, name: r.artists?.name ?? '' }))
    setArtists(names('ARTIST')); setGuests(names('SPECIAL_GUEST'))
    setLoaded(true); onDirty(false)
  }, [day.id, onDirty])
  useEffect(() => { void load() }, [load, reloadKey])

  const save = async () => {
    setMsg(null)
    const tp = types.map((t) => ({ ...t, p: parsePrice(t.price) }))
    if (tp.some((t) => t.p === 'bad')) return setMsg({ ok: false, text: 'Preço inválido. Use o formato 400,00.' })
    const dup = (l: { name: string }[]) => new Set(l.map((x) => x.name.trim().toLowerCase())).size !== l.length
    if (dup(types)) return setMsg({ ok: false, text: 'Há tipos de ingresso com o mesmo nome neste dia.' })
    if (dup(artists) || dup(guests)) return setMsg({ ok: false, text: 'Há nomes repetidos na mesma lista de artistas.' })
    setBusy(true)
    const { error } = await supabase.rpc('save_event_day', {
      p_day_id: day.id, p_lot: lot ? Number(lot) : null, p_status: status,
      p_types: tp.map((t) => ({ id: t.id ?? null, name: t.name, category: t.category, quantity: t.qty, price: t.p })),
      p_artists: [...artists.filter((a) => a.name.trim()).map((a) => ({ id: a.id ?? null, name: a.name, type: 'ARTIST' })),
                  ...guests.filter((a) => a.name.trim()).map((a) => ({ id: a.id ?? null, name: a.name, type: 'SPECIAL_GUEST' }))],
    })
    setBusy(false)
    if (error) return setMsg({ ok: false, text: error.code === '23505' ? 'Há nomes repetidos (ingressos ou artistas).' : error.message || 'Não foi possível salvar o dia.' })
    await load(); setMsg({ ok: true, text: 'Dia salvo.' })
  }

  if (!loaded) return <p className="text-sm text-muted">{msg?.text ?? 'Carregando...'}</p>
  const setT = (key: string, patch: Partial<TDraft>) => { setTypes(types.map((t) => t.key === key ? { ...t, ...patch } : t)); touch() }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:max-w-sm">
        <div><label className="mb-1 block text-xs font-semibold text-muted">Lote atual</label>
          <select className={input} value={lot} onChange={(e) => { setLot(e.target.value); touch() }}>
            <option value="">Sem lote</option>
            {Array.from({ length: Math.max(10, Number(lot) || 0) }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}º Lote</option>)}
          </select></div>
        <div><label className="mb-1 block text-xs font-semibold text-muted">Status do dia</label>
          <select className={input} value={status} onChange={(e) => { setStatus(e.target.value); touch() }}>
            {STATUS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select></div>
      </div>

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-bold">Tipos de ingresso</h4>
          <div className="flex gap-3 text-sm font-semibold text-brand-soft">
            <button type="button" onClick={onCopy} className="flex items-center gap-1"><Copy size={14} />Copiar para outros dias</button>
            <button type="button" onClick={() => { setTypes([...types, { key: uid(), name: '', category: 'CUSTOM', qty: 1, price: '' }]); touch() }} className="flex items-center gap-1"><Plus size={14} />Adicionar tipo</button>
          </div>
        </div>
        {!types.length && (
          <button type="button" onClick={() => { setTypes(STD.map(([name, category]) => ({ key: uid(), name, category, qty: 1, price: '' }))); touch() }}
            className="rounded-xl border border-dashed border-line px-3 py-2 text-sm text-muted hover:border-brand hover:text-white">Adicionar Meia, Solidária e Inteira</button>
        )}
        <ul className="space-y-2">
          {types.map((t, i) => (
            <li key={t.key} className="grid grid-cols-[1fr_7rem_auto] items-center gap-2 sm:grid-cols-[1fr_8rem_5rem_auto]">
              <input className={input} value={t.name} placeholder="Nome do ingresso" aria-label="Nome do ingresso" onChange={(e) => setT(t.key, { name: e.target.value })} />
              <input className={input} inputMode="decimal" value={t.price} placeholder="R$ 0,00" aria-label="Preço" onChange={(e) => setT(t.key, { price: e.target.value })} />
              {t.category === 'CUSTOM'
                ? <input className={`${input} hidden sm:block`} type="number" min={1} value={t.qty} aria-label="Ingressos por compra" title="Ingressos por compra" onChange={(e) => setT(t.key, { qty: Math.max(1, Number(e.target.value) || 1) })} />
                : <span className="hidden sm:block" />}
              <span className="flex">
                <button type="button" aria-label="Subir" onClick={() => { setTypes(move(types, i, -1)); touch() }} className="p-1 text-muted hover:text-white"><ArrowUp size={16} /></button>
                <button type="button" aria-label="Descer" onClick={() => { setTypes(move(types, i, 1)); touch() }} className="p-1 text-muted hover:text-white"><ArrowDown size={16} /></button>
                <button type="button" aria-label="Remover" onClick={() => { setTypes(types.filter((x) => x.key !== t.key)); touch() }} className="p-1 text-muted hover:text-alert"><Trash2 size={16} /></button>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-1 text-xs text-muted">Deixe o preço vazio se ainda não foi definido.</p>
      </div>

      <NameList title="Atrações do dia" items={artists} onChange={(l) => { setArtists(l); touch() }} add="Adicionar atração" />
      <NameList title="Participações especiais (opcional)" hint="Se não houver, esta seção não aparece no bot." items={guests} onChange={(l) => { setGuests(l); touch() }} add="Adicionar" />

      {msg && <p role="status" className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? 'bg-mint/10 text-mint' : 'bg-alert/10 text-alert'}`}>{msg.text}</p>}
      <button type="button" disabled={busy} onClick={save} className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold hover:bg-brand-soft disabled:opacity-60">{busy ? 'Salvando...' : 'Salvar dia'}</button>
    </div>
  )
}

export default function CamaroteDays({ days }: { days: Day[] }) {
  const sorted = [...days].sort((a, b) => a.event_date.localeCompare(b.event_date))
  const [sel, setSel] = useState(sorted[0]?.id ?? '')
  const [dirty, setDirty] = useState<Record<string, boolean>>({})
  const [reload, setReload] = useState(0)
  const [note, setNote] = useState<Msg>(null)
  useEffect(() => { if (!sorted.some((d) => d.id === sel)) setSel(sorted[0]?.id ?? '') }, [sorted, sel])

  const copy = async (from: Day) => {
    const others = sorted.filter((d) => d.id !== from.id)
    if (!others.length) return setNote({ ok: false, text: 'Não há outros dias para copiar.' })
    if (dirty[from.id]) return setNote({ ok: false, text: 'Salve este dia antes de copiar.' })
    if (others.some((d) => dirty[d.id]) && !window.confirm('Há alterações não salvas em outros dias. Elas serão descartadas. Continuar?')) return
    const { data, error } = await supabase.rpc('copy_day_setup', { p_from: from.id, p_to: others.map((d) => d.id) })
    if (error) return setNote({ ok: false, text: error.message })
    setReload((n) => n + 1)
    setNote({ ok: true, text: data ? `${data} tipo(s) de ingresso copiado(s). Os que já existiam foram mantidos.` : 'Nada a copiar: os outros dias já têm esses tipos.' })
  }

  if (!sorted.length) return <p className="rounded-2xl border border-dashed border-line p-4 text-sm text-muted">Salve o evento com as datas para configurar lotes, ingressos e atrações.</p>
  return (
    <section className="space-y-4 rounded-2xl border border-line bg-surface p-4">
      <h2 className="font-bold">Lotes, ingressos e atrações por dia</h2>
      <div className="flex gap-2 overflow-x-auto" role="tablist">
        {sorted.map((d) => (
          <button key={d.id} type="button" role="tab" aria-selected={sel === d.id} onClick={() => setSel(d.id)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold ${sel === d.id ? 'bg-brand text-white' : 'bg-bg text-muted hover:text-white'}`}>
            {dayLabel(d.event_date)}{dirty[d.id] ? ' •' : ''}
          </button>
        ))}
      </div>
      {note && <p role="status" className={`rounded-lg px-3 py-2 text-sm ${note.ok ? 'bg-mint/10 text-mint' : 'bg-alert/10 text-alert'}`}>{note.text}</p>}
      {sorted.map((d) => (
        <div key={d.id} hidden={sel !== d.id}>
          <DayEditor day={d} reloadKey={reload} onCopy={() => void copy(d)} onDirty={(v) => setDirty((m) => (m[d.id] === v ? m : { ...m, [d.id]: v }))} />
        </div>
      ))}
    </section>
  )
}
