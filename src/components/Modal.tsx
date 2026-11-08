import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'

export default function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h) }, [onClose])
  return (
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" onClick={onClose}>
      <div className={`max-h-[90vh] w-full overflow-y-auto rounded-2xl border border-line bg-surface p-5 ${wide ? 'max-w-3xl' : 'max-w-2xl'}`} onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-start justify-between gap-3"><h2 className="text-lg font-extrabold">{title}</h2>
          <button type="button" aria-label="Fechar" onClick={onClose} className="text-muted hover:text-white"><X size={20} /></button></div>
        {children}
      </div>
    </div>
  )
}
