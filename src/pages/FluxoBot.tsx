import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { notifyChanged } from '../lib/versions'
import { subst } from '../lib/botMenu'
import { input, type Msg } from '../lib/ui'

const STEPS: { key: string; label: string; hint: string }[] = [
  { key: 'welcome', label: 'Boas-vindas', hint: 'Primeira mensagem. O menu de eventos aparece logo abaixo dela.' },
  { key: 'invalid_option', label: 'Opção inválida', hint: 'Quando a pessoa digita algo que não é uma opção do menu.' },
  { key: 'coming_soon', label: 'Em breve', hint: 'Fecha a mensagem dos eventos marcados como Em breve.' },
  { key: 'sold_out', label: 'Esgotado', hint: 'Quando não há mais ingressos.' },
  { key: 'buy_online', label: 'Comprar Online', hint: 'Use {link} para inserir o link de compra do evento.' },
  { key: 'online_support', label: 'Suporte Compras Online', hint: 'Texto antes do contato do suporte (o contato é configurado em Configurações).' },
  { key: 'talk_to_attendant', label: 'Falar com Atendente', hint: 'Use {horario} para inserir o horário de atendimento.' },
  { key: 'closing', label: 'Encerramento', hint: 'Última mensagem da conversa.' },
]

export default function FluxoBot() {
  const [msgs, setMsgs] = useState<Record<string, string> | null>(null)
  const [sel, setSel] = useState(STEPS[0].key)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<Msg>(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('bot_settings').select('value').eq('key', 'bot.messages').single()
    if (error || !data) return setNote({ ok: false, text: 'Não foi possível carregar as mensagens.' })
    setMsgs((data as { value: Record<string, string> }).value); setDirty(false)
  }, [])
  useEffect(() => { void load() }, [load])

  const save = async () => {
    setNote(null); setBusy(true)
    const { data, error } = await supabase.rpc('save_bot_setting', { p_key: 'bot.messages', p_value: msgs })
    setBusy(false)
    if (error) return setNote({ ok: false, text: error.message || 'Não foi possível salvar.' })
    await load(); notifyChanged()
    setNote({ ok: true, text: (data as { changed?: boolean } | null)?.changed === false ? 'Nenhuma alteração para salvar.' : 'Mensagens salvas. Falta publicar para o bot usar.' })
  }

  const step = STEPS.find((s) => s.key === sel)!
  const sample = (t: string) => subst(t, { link: 'https://pointdoingresso.com/evento', horario: 'Segunda a sábado: 10h às 22h\nDomingos e feriados: 14h às 20h' })
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-extrabold">Fluxo do Bot</h1>
      <p className="mb-5 text-sm text-muted">Edite as mensagens do bot. Salvar não publica: o bot só muda quando você clicar em Publicar no Bot.</p>
      {note && <p role="status" className={`mb-3 rounded-lg px-3 py-2 text-sm ${note.ok ? 'bg-mint/10 text-mint' : 'bg-alert/10 text-alert'}`}>{note.text}</p>}
      {!msgs && !note && <p className="text-sm text-muted">Carregando...</p>}
      {msgs && (
        <div className="grid gap-4 md:grid-cols-[14rem_1fr]">
          <ul className="flex gap-2 overflow-x-auto md:flex-col" role="tablist">
            {STEPS.map((s, i) => (
              <li key={s.key} className="shrink-0"><button type="button" role="tab" aria-selected={sel === s.key} onClick={() => setSel(s.key)}
                className={`w-full rounded-xl px-3 py-2 text-left text-sm font-semibold ${sel === s.key ? 'bg-brand text-white' : 'bg-surface text-muted hover:text-white'}`}>{i + 1}. {s.label}</button></li>
            ))}
          </ul>
          <div className="space-y-4 rounded-2xl border border-line bg-surface p-4">
            <div><label htmlFor="msg" className="mb-1 block text-sm font-bold">{step.label}</label>
              <textarea id="msg" rows={7} maxLength={2000} className={input} value={msgs[sel] ?? ''} onChange={(e) => { setMsgs({ ...msgs, [sel]: e.target.value }); setDirty(true) }} />
              <p className="mt-1 text-xs text-muted">{step.hint} ({(msgs[sel] ?? '').length}/2000)</p></div>
            <div><div className="mb-1 text-xs font-semibold text-muted">Como aparece no WhatsApp</div>
              <div className="rounded-2xl bg-[#0b141a] p-3"><div className="rounded-xl bg-[#202c33] p-3 text-sm text-white"><pre className="whitespace-pre-wrap font-sans">{sample(msgs[sel] ?? '')}</pre></div></div></div>
            <button type="button" disabled={busy} onClick={() => void save()} className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold hover:bg-brand-soft disabled:opacity-60">{busy ? 'Salvando...' : dirty ? 'Salvar mensagens •' : 'Salvar mensagens'}</button>
          </div>
        </div>
      )}
    </div>
  )
}
