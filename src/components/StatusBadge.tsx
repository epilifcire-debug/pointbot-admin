import type { EventStatus } from '../lib/events'
import { STATUS_LABEL } from '../lib/events'

const tone: Record<EventStatus | 'ENCERRADO', string> = {
  ATIVO: 'bg-mint/15 text-mint', EM_BREVE: 'bg-sun/15 text-sun', INATIVO: 'bg-muted/15 text-muted', ENCERRADO: 'bg-alert/15 text-alert',
}
export default function StatusBadge({ status, expired }: { status: EventStatus; expired?: boolean }) {
  const k = expired && status !== 'INATIVO' ? 'ENCERRADO' : status
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${tone[k]}`}>{k === 'ENCERRADO' ? 'Encerrado' : STATUS_LABEL[status]}</span>
}
