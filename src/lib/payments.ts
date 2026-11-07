// Mesma regra da função payment_condition_label do banco (a API do bot usa a do banco).
export function paymentLabel(c: { cash: boolean; max: number | string; sur: boolean }) {
  if (c.cash) return 'à vista'
  return c.sur ? `até ${c.max}x` : `até ${c.max}x sem juros`
}
// Padrões oferecidos só no Pré-Caju (nunca aplicados sozinhos e sempre editáveis)
export const PRE_CAJU_DEFAULTS = [
  { name: 'Banese Card / Elo', max: 10 },
  { name: 'Demais cartões', max: 5 },
]
