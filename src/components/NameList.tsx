import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { input, move, uid } from '../lib/ui'

export type NDraft = { key: string; id?: string; name: string }

export default function NameList({ title, hint, items, onChange, add }: { title: string; hint?: string; items: NDraft[]; onChange: (l: NDraft[]) => void; add: string }) {
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
