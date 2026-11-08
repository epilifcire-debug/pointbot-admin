import { useCallback, useEffect, useState } from 'react'
import { commitVersion, savedText } from '../lib/versions'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { dayLabel, input, move, uid, type Day, type Msg } from '../lib/ui'
import { PRE_CAJU_DEFAULTS, paymentLabel } from '../lib/payments'
import type { EventType } from '../lib/events'

type C = { key: string; id?: string; name: string; method: string; group: string; cash: boolean; max: string; sur: boolean; stext: string; active: boolean; scope: string }
type Opt = { value: string; label: string }
const METHODS: [string, string][] = [['CARTAO', 'Cartão'], ['PIX', 'PIX'], ['DINHEIRO', 'Dinheiro'], ['OUTRO', 'Outro']]
const lbl = 'mb-1 block text-xs font-semibold text-muted'
const blank = (): C => ({ key: uid(), name: '', method: 'CARTAO', group: '', cash: false, max: '', sur: false, stext: '', active: true, scope: 'EVENT' })

export default function PaymentsEditor({ eventId, type, days }: { eventId: string; type: EventType; days: Day[] }) {
  const [items, setItems] = useState<C[]>([])
  const [areaOpts, setAreaOpts] = useState<Opt[]>([])
  const [pkgOpts, setPkgOpts] = useState<Opt[]>([])
  const [loaded, setLoaded] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<Msg>(null)
  const external = type === 'EVENTO_EXTERNO'

  const loadOpts = useCallback(async () => {
    if (external) {
      const { data } = await supabase.from('event_areas').select('id,name,sort_order').eq('event_id', eventId).order('sort_order')
      setAreaOpts((data ?? []).map((a: any) => ({ value: `AREA:${a.id}`, label: `Área: ${a.name}` })))
    } else {
      const { data } = await supabase.from('packages').select('id,name,sort_order').eq('event_id', eventId).order('sort_order')
      setPkgOpts((data ?? []).map((p: any) => ({ value: `PACKAGE:${p.id}`, label: `Pacote: ${p.name}` })))
    }
  }, [eventId, external])

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('payment_conditions')
      .select('id,name,payment_method,card_group,max_installments,cash_only,has_surcharge,surcharge_text,active,scope_type,scope_id,sort_order')
      .eq('event_id', eventId).order('sort_order')
    if (error) return setMsg({ ok: false, text: 'Não foi possível carregar as formas de pagamento.' })
    setItems((data ?? []).map((r: any) => ({ key: r.id, id: r.id, name: r.name, method: r.payment_method, group: r.card_group ?? '', cash: r.cash_only,
      max: r.max_installments ? String(r.max_installments) : '', sur: r.has_surcharge, stext: r.surcharge_text ?? '', active: r.active,
      scope: r.scope_type === 'EVENT' ? 'EVENT' : `${r.scope_type}:${r.scope_id}` })))
    setDirty(false); setLoaded(true)
  }, [eventId])
  useEffect(() => { void load(); void loadOpts() }, [load, loadOpts])

  const set = (key: string, patch: Partial<C>) => { setItems((l) => l.map((c) => c.key === key ? { ...c, ...patch } : c)); setDirty(true) }
  const dayOpts: Opt[] = external ? [] : [...days].sort((a, b) => a.event_date.localeCompare(b.event_date)).map((d) => ({ value: `DATE:${d.id}`, label: `Dia: ${dayLabel(d.event_date)}` }))
  const scopeOpts: Opt[] = [{ value: 'EVENT', label: 'Todo o evento' }, ...areaOpts, ...dayOpts, ...pkgOpts]

  const save = async () => {
    setMsg(null)
    for (const c of items) {
      if (!c.name.trim()) return setMsg({ ok: false, text: 'Informe o nome de todas as condições.' })
      const cash = c.cash || c.method === 'PIX' || c.method === 'DINHEIRO'
      const n = Number(c.max)
      if (!cash && !(Number.isInteger(n) && n >= 1 && n <= 24)) return setMsg({ ok: false, text: `As parcelas de "${c.name}" devem ficar entre 1 e 24.` })
      if (!cash && c.sur && !c.stext.trim()) return setMsg({ ok: false, text: `Informe o texto do acréscimo de "${c.name}".` })
    }
    setBusy(true)
    const { error } = await supabase.rpc('save_payment_conditions', { p_event: eventId, p_items: items.map((c) => {
      const [st, sid] = c.scope === 'EVENT' ? ['EVENT', null] : c.scope.split(':')
      return { id: c.id ?? null, name: c.name, method: c.method, card_group: c.method === 'CARTAO' ? (c.group || c.name) : null, cash_only: c.cash,
        max_installments: c.max ? Number(c.max) : null, has_surcharge: c.sur, surcharge_text: c.stext, active: c.active, scope_type: st, scope_id: sid }
    }) })
    setBusy(false)
    if (error) return setMsg({ ok: false, text: error.message || 'Não foi possível salvar.' })
    await load(); const r = await commitVersion(eventId); setMsg({ ok: true, text: savedText('Formas de pagamento salvas.', r) })
  }

  if (!loaded) return <p className="text-sm text-muted">{msg?.text ?? 'Carregando pagamentos...'}</p>

  const general = items.filter((c) => c.scope === 'EVENT')
  const offerDefaults = !external && !items.length
  const scopeName = (v: string) => scopeOpts.find((o) => o.value === v)?.label ?? 'Escopo removido'
  const line = (c: C) => {
    const cash = c.cash || c.method === 'PIX' || c.method === 'DINHEIRO'
    return `${c.name || '...'} — ${paymentLabel({ cash, max: c.max || '?', sur: c.sur })}`
  }

  return (
    <section className="space-y-4 rounded-2xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold">Formas de pagamento</h2>
        <button type="button" onClick={() => { setItems((l) => [...l, blank()]); setDirty(true) }} className="flex items-center gap-1 text-sm font-semibold text-brand-soft"><Plus size={14} />Adicionar condição</button>
      </div>
      <p className="text-xs text-muted">Valem para todo o evento, a menos que você escolha uma área, dia ou pacote específico.{external ? ' Ex.: Qualquer cartão, até 3x.' : ''}</p>

      {offerDefaults && (
        <div className="rounded-xl border border-dashed border-brand/50 bg-brand/5 p-3 text-sm">
          <p>Sugestão para o Pré-Caju: Banese Card / Elo em até 10x sem juros e demais cartões em até 5x sem juros. Você pode editar depois.</p>
          <button type="button" onClick={() => { setItems(PRE_CAJU_DEFAULTS.map((d) => ({ ...blank(), name: d.name, group: d.name, max: String(d.max) }))); setDirty(true) }}
            className="mt-2 rounded-lg bg-brand px-3 py-1.5 font-semibold hover:bg-brand-soft">Usar sugestão do Pré-Caju</button>
        </div>
      )}
      {!items.length && !offerDefaults && <p className="text-xs text-muted">Nenhuma condição ainda. Sem condições, o bot não mostra a seção de pagamento.</p>}

      <ul className="space-y-3">
        {items.map((c, i) => {
          const cashOnly = c.cash || c.method === 'PIX' || c.method === 'DINHEIRO'
          return (
            <li key={c.key} className="space-y-3 rounded-xl border border-line bg-bg p-3">
              <div className="grid gap-3 sm:grid-cols-[1fr_9rem_9rem]">
                <div><label className={lbl}>Nome</label><input className={input} value={c.name} placeholder="Ex.: Qualquer cartão" onChange={(e) => set(c.key, { name: e.target.value })} /></div>
                <div><label className={lbl}>Meio</label>
                  <select className={input} value={c.method} onChange={(e) => set(c.key, { method: e.target.value, cash: e.target.value === 'PIX' || e.target.value === 'DINHEIRO' ? true : c.cash })}>
                    {METHODS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
                <div><label className={lbl}>Vale para</label>
                  <select className={input} value={c.scope} onChange={(e) => set(c.key, { scope: e.target.value })} onFocus={() => void loadOpts()}>
                    {!scopeOpts.some((o) => o.value === c.scope) && <option value={c.scope}>{scopeName(c.scope)}</option>}
                    {scopeOpts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select></div>
              </div>
              <div className="flex flex-wrap items-end gap-x-5 gap-y-2 text-sm">
                {c.method !== 'PIX' && c.method !== 'DINHEIRO' && (
                  <label className="flex items-center gap-2"><input type="checkbox" checked={c.cash} onChange={(e) => set(c.key, { cash: e.target.checked })} />À vista (sem parcelar)</label>
                )}
                {!cashOnly && (
                  <>
                    <div className="w-28"><label className={lbl}>Parcelas (até)</label><input className={input} type="number" min={1} max={24} value={c.max} aria-label="Parcelas" onChange={(e) => set(c.key, { max: e.target.value })} /></div>
                    <label className="flex items-center gap-2"><input type="checkbox" checked={c.sur} onChange={(e) => set(c.key, { sur: e.target.checked })} />Acréscimo no parcelamento</label>
                  </>
                )}
                <label className="flex items-center gap-2"><input type="checkbox" checked={c.active} onChange={(e) => set(c.key, { active: e.target.checked })} />Ativa</label>
                <span className="ml-auto flex">
                  <button type="button" aria-label="Subir" onClick={() => { setItems((l) => move(l, i, -1)); setDirty(true) }} className="p-1 text-muted hover:text-white"><ArrowUp size={16} /></button>
                  <button type="button" aria-label="Descer" onClick={() => { setItems((l) => move(l, i, 1)); setDirty(true) }} className="p-1 text-muted hover:text-white"><ArrowDown size={16} /></button>
                  <button type="button" aria-label="Remover condição" onClick={() => { setItems((l) => l.filter((x) => x.key !== c.key)); setDirty(true) }} className="p-1 text-muted hover:text-alert"><Trash2 size={16} /></button>
                </span>
              </div>
              {!cashOnly && c.sur && (
                <div><label className={lbl}>Informação do acréscimo (aparece no bot)</label>
                  <input className={input} value={c.stext} aria-label="Texto do acréscimo" placeholder="Ex.: Acréscimo de 2,5% ao mês" onChange={(e) => set(c.key, { stext: e.target.value })} /></div>
              )}
            </li>
          )
        })}
      </ul>

      {items.some((c) => c.active) && (
        <div className="rounded-xl bg-bg p-3 text-sm">
          <div className="mb-1 text-xs font-semibold text-muted">Como aparece no bot</div>
          <ul className="space-y-1">
            {items.filter((c) => c.active).map((c) => (
              <li key={c.key}>
                {c.scope !== 'EVENT' && <span className="mr-1 text-xs text-muted">[{scopeName(c.scope)}]</span>}{line(c)}
                {c.sur && !c.cash && c.method !== 'PIX' && c.method !== 'DINHEIRO' && c.stext.trim() && <div className="text-xs text-muted">{c.stext.trim()}</div>}
              </li>
            ))}
          </ul>
          {!general.some((c) => c.active) && <p className="mt-2 text-xs text-sun">Nenhuma condição ativa vale para todo o evento.</p>}
        </div>
      )}

      {msg && <p role="status" className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? 'bg-mint/10 text-mint' : 'bg-alert/10 text-alert'}`}>{msg.text}</p>}
      <button type="button" disabled={busy} onClick={save} className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold hover:bg-brand-soft disabled:opacity-60">{busy ? 'Salvando...' : dirty ? 'Salvar pagamentos •' : 'Salvar pagamentos'}</button>
    </section>
  )
}
