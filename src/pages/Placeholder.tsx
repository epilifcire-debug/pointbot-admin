export default function Placeholder({ title, step }: { title: string; step: string }) {
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-extrabold">{title}</h1>
      <p className="mt-2 rounded-2xl border border-dashed border-line p-6 text-sm text-muted">
        Esta tela será construída na etapa {step}.
      </p>
    </div>
  )
}
