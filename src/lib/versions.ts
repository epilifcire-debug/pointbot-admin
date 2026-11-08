import { supabase } from './supabase'

export type CommitResult = { created: boolean | null; seq?: number; error?: string }

// Registra uma versão se (e só se) o conteúdo do evento mudou desde a última.
export async function commitVersion(eventId: string): Promise<CommitResult> {
  const { data, error } = await supabase.rpc('commit_event_version', { p_event: eventId })
  if (error) return { created: null, error: error.message }
  const r = data as { created?: boolean; seq?: number } | null
  return { created: r?.created ?? null, seq: r?.seq }
}

export function savedText(base: string, r: CommitResult) {
  if (r.error) return `${base} Não foi possível registrar a versão: ${r.error}`
  if (r.created === false) return 'Nenhuma alteração para salvar.'
  if (r.created && r.seq) return `${base} Versão #${r.seq} registrada.`
  return base
}

export const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Maceio', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
