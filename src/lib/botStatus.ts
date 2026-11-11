// Regras do selo do WhatsApp do bot (sem React, para poder testar).
export type BotStatusData = {
  whatsapp_status: string
  connected: boolean
  phone?: string | null
  bot_version?: number | null
  published_version?: number | null
  degraded?: boolean
  uptime_seconds?: number | null
  last_seen?: string | null
  age_seconds: number | null
}

// O bot avisa a cada 60 s. Passou de 3 min sem aviso = bot ou servidor fora do ar.
export const STALE_SECONDS = 180

export type BotView = { tone: 'ok' | 'bad' | 'off'; label: string; hint: string; age: number | null; outdated: boolean }

const HINT: Record<string, string> = {
  logged_out: 'A sessão do WhatsApp foi encerrada. É preciso ler o QR Code de novo no servidor.',
  waiting_qr: 'O bot está aguardando a leitura do QR Code no servidor.',
  reconnecting: 'O bot perdeu a conexão e está tentando reconectar.',
  connecting: 'O bot está iniciando a conexão com o WhatsApp.',
  disconnecting: 'O bot está encerrando a conexão.',
  error: 'O bot encontrou um erro na conexão com o WhatsApp.',
}

// elapsed = segundos desde a última consulta ao servidor (o sinal continua envelhecendo na tela)
export function botStatusView(data: BotStatusData | null, elapsed = 0, failed = false): BotView {
  if (failed) return { tone: 'off', label: 'Sem sinal', hint: 'Não foi possível consultar o estado do bot agora.', age: null, outdated: false }
  if (!data) return { tone: 'off', label: 'Verificando', hint: 'Consultando o estado do bot...', age: null, outdated: false }
  const age = data.age_seconds == null ? null : data.age_seconds + Math.max(0, elapsed)
  if (age == null) return { tone: 'off', label: 'Sem sinal', hint: 'O bot ainda não enviou nenhum sinal para o painel.', age, outdated: false }
  if (age > STALE_SECONDS)
    return { tone: 'off', label: 'Sem sinal', hint: 'O bot parou de enviar sinal. O servidor ou o container pode estar fora do ar.', age, outdated: false }
  const outdated = data.bot_version != null && data.published_version != null && data.bot_version !== data.published_version
  if (data.connected && data.whatsapp_status === 'connected')
    return { tone: 'ok', label: 'Conectado', hint: 'O bot está conectado ao WhatsApp e atendendo.', age, outdated }
  return { tone: 'bad', label: 'Desconectado', hint: HINT[data.whatsapp_status] ?? 'O bot não está conectado ao WhatsApp.', age, outdated }
}

export function sinceText(seconds: number): string {
  if (seconds < 60) return 'agora há pouco'
  const m = Math.floor(seconds / 60)
  if (m < 60) return `há ${m} min`
  const h = Math.floor(m / 60)
  if (h < 48) return `há ${h} h`
  return `há ${Math.floor(h / 24)} dias`
}
