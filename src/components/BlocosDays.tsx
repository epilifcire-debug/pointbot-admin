import { useCallback, useEffect, useRef, useState } from 'react'
import { commitVersion, savedText } from '../lib/versions'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { STATUS, dayLabel, fmtPrice, input, move, parsePrice, uid, type Day, type Msg } from '../lib/ui'

type B = { key: string; id?: string; name: string; artist: string; lot: string; price: string; status: string; url: string }
const lbl = 'mb-1 block text-xs font-semibold text-muted'

function DayBlocks({ day, eventId, onDirty, onSaved }: { day: Day; eventId: string; onDirty: (d: boolean) => void; onSaved: () => void }) {
  const [blocks, setBlocks] = useState<B[]>([])
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<Msg>(null)
  const dirtyRef = useRef(onDirty)
  dirtyRef.current = onDirty

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('blocks')
      .select('id,name,current_lot,price,status,purchase_url,sort_order,artists(name)').eq('event_date_id', day.id).order('sort_order')
    if (error) return setMsg({ ok: false, text: 'Não foi possível carregar os blocos.' })
    setBlocks((data ?? []).map((r: any) => ({ key: r.id, id: r.id, name: r.name, artist: r.artists?.name ?? '', lot: r.current_lot ? String(r.current_lot) : '',
      price: r.price != null ? fmtPrice(r.price) : '', status: r.status, url: r.purchase_url ?? '' })))
    setLoaded(true); dirtyRef.current(false)
  }, [day.id])
  useEffect(() => { void load() }, [load])

  const set = (key: string, patch: Partial<B>) => { setBlocks(blocks.map((b) => b.key === key ? { ...b, ...patch } : b)); onDirty(true) }

  const save = async () => {
    setMsg(null)
    const parsed = blocks.map((b) => ({ ...b, p: parsePrice(b.price) }))
    if (parsed.some((b) => b.p === 'bad')) return setMsg({ ok: false, text: 'Preço inválido. Use o formato 220,00.' })
    setBusy(true)
    const { error } = await supabase.rpc('save_day_blocks', {
      p_day_id: day.id,
      p_blocks: parsed.map((b) => ({ id: b.id ?? null, name: b.name, artist: b.artist, lot: b.lot ? Number(b.lot) : null, price: b.p, status: b.status, url: b.url })),
    })
    setBusy(false)
    if (error) return setMsg({ ok: false, text: error.code === '23503' ? 'Um bloco removido faz parte de um pacote. Tire-o do pacote antes.' : error.message || 'Não foi possível salvar.' })
    await load(); onSaved(); const r = await commitVersion(eventId); setMsg({ ok: true, text: savedText('Blocos salvos.', r) })
  }

  if (!loaded) return <p className="text-sm text-muted">{msg?.text ?? 'Carregando...'}</p>
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-bold">Blocos do dia</h4>
        <button type="button" onClick={() => { setBlocks([...blocks, { key: uid(), name: '', artist: '', lot: '', price: '', status: 'ON_SALE', url: '' }]); onDirty(true) }}
          className="flex items-center gap-1 text-sm font-semibold text-brand-soft"><Plus size={14} />Adicionar bloco</button>
      </div>
      {!blocks.length && <p className="text-xs text-muted">Nenhum bloco neste dia. Blocos têm preço único, sem Meia, Solidária ou Inteira.</p>}
      <ul className="space-y-3">
        {blocks.map((b, i) => (
          <li key={b.key} className="space-y-3 rounded-xl border border-line bg-bg p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div><label className={lbl}>Bloco</label><input className={input} value={b.name} onChange={(e) => set(b.key, { name: e.target.value })} placeholder="Ex.: Vumbora" /></div>
              <div><label className={lbl}>Artista</label><input className={input} value={b.artist} onChange={(e) => set(b.key, { artist: e.target.value })} placeholder="Ex.: Bell Marques" /></div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><label className={lbl}>Lote</label>
                <select className={input} value={b.lot} onChange={(e) => set(b.key, { lot: e.target.value })}>
                  <option value="">Sem lote</option>
                  {Array.from({ length: Math.max(10, Number(b.lot) || 0) }, (_, n) => n + 1).map((n) => <option key={n} value={n}>{n}º Lote</option>)}
                </select></div>
              <div><label className={lbl}>Preço único</label><input className={input} inputMode="decimal" value={b.price} onChange={(e) => set(b.key, { price: e.target.value })} placeholder="R$ 0,00" /></div>
              <div><label className={lbl}>Status</label>
                <select className={input} value={b.status} onChange={(e) => set(b.key, { status: e.target.value })}>{STATUS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
            </div>
            <div className="flex items-end gap-2">
              <div className="flex-1"><label className={lbl}>Link de compra (opcional)</label><input className={input} type="url" value={b.url} onChange={(e) => set(b.key, { url: e.target.value })} placeholder="https://" /></div>
              <button type="button" aria-label="Subir" onClick={() => { setBlocks(move(blocks, i, -1)); onDirty(true) }} className="p-2 text-muted hover:text-white"><ArrowUp size={16} /></button>
              <button type="button" aria-label="Descer" onClick={() => { setBlocks(move(blocks, i, 1)); onDirty(true) }} className="p-2 text-muted hover:text-white"><ArrowDown size={16} /></button>
              <button type="button" aria-label="Remover bloco" onClick={() => { setBlocks(blocks.filter((x) => x.key !== b.key)); onDirty(true) }} className="p-2 text-muted hover:text-alert"><Trash2 size={16} /></button>
            </div>
          </li>
        ))}
      </ul>
      {msg && <p role="status" className={`rounded-lg px-3 py-2 text-sm ${msg.ok ? 'bg-mint/10 text-mint' : 'bg-alert/10 text-alert'}`}>{msg.text}</p>}
      <button type="button" disabled={busy} onClick={save} className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold hover:bg-brand-soft disabled:opacity-60">{busy ? 'Salvando...' : 'Salvar dia'}</button>
    </div>
  )
}

export default function BlocosDays({ days, eventId, onSaved }: { days: Day[]; eventId: string; onSaved: () => void }) {
  const sorted = [...days].sort((a, b) => a.event_date.localeCompare(b.event_date))
  const [sel, setSel] = useState(sorted[0]?.id ?? '')
  const [dirty, setDirty] = useState<Record<string, boolean>>({})
  useEffect(() => { if (!sorted.some((d) => d.id === sel)) setSel(sorted[0]?.id ?? '') }, [sorted, sel])
  if (!sorted.length) return <p className="rounded-2xl border border-dashed border-line p-4 text-sm text-muted">Salve o evento com as datas para cadastrar os blocos.</p>
  return (
    <section className="space-y-4 rounded-2xl border border-line bg-surface p-4">
      <h2 className="font-bold">Blocos por dia</h2>
      <div className="flex gap-2 overflow-x-auto" role="tablist">
        {sorted.map((d) => (
          <button key={d.id} type="button" role="tab" aria-selected={sel === d.id} onClick={() => setSel(d.id)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold ${sel === d.id ? 'bg-brand text-white' : 'bg-bg text-muted hover:text-white'}`}>
            {dayLabel(d.event_date)}{dirty[d.id] ? ' •' : ''}
          </button>
        ))}
      </div>
      {sorted.map((d) => (
        <div key={d.id} hidden={sel !== d.id}>
          <DayBlocks day={d} eventId={eventId} onSaved={onSaved} onDirty={(v) => setDirty((m) => (m[d.id] === v ? m : { ...m, [d.id]: v }))} />
        </div>
      ))}
    </section>
  )
}
