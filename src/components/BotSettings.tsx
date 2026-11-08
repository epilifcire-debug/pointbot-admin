import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { notifyChanged } from '../lib/versions'
import { input, type Msg } from '../lib/ui'

const lbl = 'mb-1 block text-xs font-semibold text-muted'

function useSetting<T>(key: string) {
  const [value, setValue] = useState<T | null>(null)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<Msg>(null)
  const [dirty, setDirty] = useState(false)
  const load = useCallback(async () => {
    const { data, error } = await supabase.from('bot_settings').select('value').eq('key', key).single()
    if (error || !data) return setNote({ ok: false, text: 'Não foi possível carregar.' })
    setValue((data as { value: T }).value); setDirty(false)
  }, [key])
  useEffect(() => { void load() }, [load])
  const save = async (v: T) => {
    setNote(null); setBusy(true)
    const { data, error } = await supabase.rpc('save_bot_setting', { p_key: key, p_value: v })
    setBusy(false)
    if (error) return setNote({ ok: false, text: error.message || 'Não foi possível salvar.' })
    await load(); notifyChanged()
    setNote({ ok: true, text: (data as { changed?: boolean } | null)?.changed === false ? 'Nenhuma alteração para salvar.' : 'Salvo. Falta publicar para o bot usar.' })
  }
  return { value, setValue: (v: T) => { setValue(v); setDirty(true) }, busy, note, dirty, save }
}
const Note = ({ m }: { m: Msg }) => (m ? <p role="status" className={`rounded-lg px-3 py-2 text-sm ${m.ok ? 'bg-mint/10 text-mint' : 'bg-alert/10 text-alert'}`}>{m.text}</p> : null)

type Att = { mon_sat: { start: string; end: string }; sun_holiday: { start: string; end: string } }
export function AttendanceForm() {
  const s = useSetting<Att>('bot.attendance')
  if (!s.value) return <p className="text-sm text-muted">{s.note?.text ?? 'Carregando...'}</p>
  const v = s.value
  const row = (k: 'mon_sat' | 'sun_holiday', label: string) => (
    <div className="grid grid-cols-[1fr_7rem_7rem] items-end gap-3">
      <span className="pb-2 text-sm font-semibold">{label}</span>
      <div><label className={lbl}>Início</label><input type="time" aria-label={`${label}: início`} className={input} value={v[k].start} onChange={(e) => s.setValue({ ...v, [k]: { ...v[k], start: e.target.value } })} /></div>
      <div><label className={lbl}>Fim</label><input type="time" aria-label={`${label}: fim`} className={input} value={v[k].end} onChange={(e) => s.setValue({ ...v, [k]: { ...v[k], end: e.target.value } })} /></div>
    </div>
  )
  return (
    <div className="space-y-4 rounded-2xl border border-line bg-surface p-4">
      <h2 className="font-bold">Horário de atendimento</h2>
      <p className="text-xs text-muted">Aparece na mensagem "Falar com Atendente". Feriados seguem o horário de domingo.</p>
      {row('mon_sat', 'Segunda a sábado')}{row('sun_holiday', 'Domingos e feriados')}
      <Note m={s.note} />
      <button type="button" disabled={s.busy} onClick={() => void s.save(v)} className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold hover:bg-brand-soft disabled:opacity-60">{s.busy ? 'Salvando...' : s.dirty ? 'Salvar horários •' : 'Salvar horários'}</button>
    </div>
  )
}

type Sup = { title: string; name: string; phone: string; message: string; initial_message: string; active: boolean }
export function SupportForm() {
  const s = useSetting<Sup>('bot.support')
  const [localErr, setLocalErr] = useState<string | null>(null)
  if (!s.value) return <p className="text-sm text-muted">{s.note?.text ?? 'Carregando...'}</p>
  const v = s.value
  const set = (patch: Partial<Sup>) => { setLocalErr(null); s.setValue({ ...v, ...patch }) }
  const save = () => {
    if (v.active && v.phone.replace(/\D/g, '').length < 10) return setLocalErr('Informe o telefone do suporte (com DDD) para ativá-lo.')
    void s.save(v)
  }
  return (
    <div className="space-y-4 rounded-2xl border border-line bg-surface p-4">
      <h2 className="font-bold">Suporte Compras Online</h2>
      <p className="text-xs text-muted">Contato que o bot oferece para quem tem dúvida ou problema na compra online. O número não fica no código: é só o que você configura aqui.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><label className={lbl} htmlFor="sp-t">Título</label><input id="sp-t" className={input} value={v.title} onChange={(e) => set({ title: e.target.value })} /></div>
        <div><label className={lbl} htmlFor="sp-n">Nome do contato</label><input id="sp-n" className={input} value={v.name} onChange={(e) => set({ name: e.target.value })} /></div>
        <div><label className={lbl} htmlFor="sp-p">Telefone (WhatsApp, com DDD)</label><input id="sp-p" inputMode="tel" className={input} value={v.phone} placeholder="(79) 90000-0000" onChange={(e) => set({ phone: e.target.value })} /></div>
      </div>
      <div><label className={lbl} htmlFor="sp-m">Mensagem exibida no bot</label><textarea id="sp-m" rows={3} className={input} value={v.message} onChange={(e) => set({ message: e.target.value })} /></div>
      <div><label className={lbl} htmlFor="sp-i">Mensagem inicial (já preenchida no WhatsApp do cliente)</label><textarea id="sp-i" rows={2} className={input} value={v.initial_message} onChange={(e) => set({ initial_message: e.target.value })} /></div>
      <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={v.active} onChange={(e) => set({ active: e.target.checked })} />Suporte ativo</label>
      {localErr && <p role="alert" className="rounded-lg bg-alert/10 px-3 py-2 text-sm text-alert">{localErr}</p>}
      <Note m={s.note} />
      <button type="button" disabled={s.busy} onClick={save} className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold hover:bg-brand-soft disabled:opacity-60">{s.busy ? 'Salvando...' : s.dirty ? 'Salvar suporte •' : 'Salvar suporte'}</button>
    </div>
  )
}
