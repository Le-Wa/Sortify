/** Tarifs publics en $ par million de tokens : entrée, sortie, lecture du cache (écriture du cache = 1,25 × entrée). */
const PRICES: Record<string, { input: number; output: number; cacheRead: number }> = {
  "claude-fable-5-1": { input: 10, output: 50, cacheRead: 0.25 },
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.2 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheRead: 0.01 },
};

/** Coût en $ d'un appel, au tarif public ; un modèle inconnu est compté au tarif d'Opus. */
export function costOf(model: string, t: { input: number; output: number; cacheWrite: number; cacheRead: number }): number {
  const price = PRICES[model] ?? PRICES["claude-opus-5-5"];
  return (t.input * price.input + t.cacheWrite * price.input * 1.25 + t.cacheRead * price.cacheRead + t.output * price.output) / 1e6;
}
