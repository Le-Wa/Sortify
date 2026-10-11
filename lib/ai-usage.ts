import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { db } from "./db";

/** Tarifs publics en $ par million de tokens : entrée, sortie, lecture du cache (écriture du cache = 1,25 × entrée). */
const PRICES: Record<string, { input: number; output: number; cacheRead: number }> = {
  "claude-fable-5-1": { input: 10, output: 50, cacheRead: 0.25 },
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.2 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheRead: 0.01 },
};

interface UsageScope {
  memberId: string | null;
  scope: string;
  pending: Promise<void>[];
}

const current = new AsyncLocalStorage<UsageScope>();

/**
 * Rattache les appels à l'IA faits dans `fn` à un membre et à une tâche,
 * et attend l'enregistrement de leur consommation avant de rendre la main.
 */
export async function withUsage<T>(memberId: string | null, scope: string, fn: () => Promise<T>): Promise<T> {
  const s: UsageScope = { memberId, scope, pending: [] };
  try {
    return await current.run(s, fn);
  } finally {
    await Promise.allSettled(s.pending);
  }
}

export interface UsageLike {
  model?: string;
  usage?: {
    input_tokens?: number | null;
    output_tokens?: number | null;
    cache_creation_input_tokens?: number | null;
    cache_read_input_tokens?: number | null;
  } | null;
}

/** Enregistre la consommation d'une réponse de l'IA (sans jamais faire échouer l'appel). */
export function recordUsage(message: UsageLike, step: string): void {
  if (!message.usage || !message.model) return;
  const s = current.getStore();
  const input = message.usage.input_tokens ?? 0;
  const output = message.usage.output_tokens ?? 0;
  const cacheWrite = message.usage.cache_creation_input_tokens ?? 0;
  const cacheRead = message.usage.cache_read_input_tokens ?? 0;
  const price = PRICES[message.model] ?? PRICES["claude-opus-5-5"];
  const cost = (input * price.input + cacheWrite * price.input * 1.25 + cacheRead * price.cacheRead + output * price.output) / 1e6;
  const insert = (async () => {
    const { error } = await db().from("ai_usage").insert({
      member_id: s?.memberId ?? null,
      scope: s?.scope ?? "hors app",
      step,
      model: message.model,
      input_tokens: input,
      cache_write_tokens: cacheWrite,
      cache_read_tokens: cacheRead,
      output_tokens: output,
      cost_usd: Math.round(cost * 1e5) / 1e5,
    });
    if (error) console.error("Consommation de l'IA non enregistrée :", error.message);
  })();
  if (s) s.pending.push(insert);
}
