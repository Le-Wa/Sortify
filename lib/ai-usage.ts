import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { costOf } from "./ai-cost";
import { memberAnthropicKey } from "./own-keys";
import { db } from "./db";

interface UsageScope {
  memberId: string | null;
  scope: string;
  /** Clé Anthropic personnelle du membre (onboarding « power user »), sinon celle de Sortify. */
  apiKey: string | null;
  pending: Promise<void>[];
}

const current = new AsyncLocalStorage<UsageScope>();

/**
 * Rattache les appels à l'IA faits dans `fn` à un membre et à une tâche,
 * et attend l'enregistrement de leur consommation avant de rendre la main.
 */
export async function withUsage<T>(memberId: string | null, scope: string, fn: () => Promise<T>): Promise<T> {
  const apiKey = memberId ? await memberAnthropicKey(memberId) : null;
  const s: UsageScope = { memberId, scope, apiKey, pending: [] };
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

/** Clé Anthropic à utiliser pour l'appel en cours (null : celle de Sortify). */
export function currentApiKey(): string | null {
  return current.getStore()?.apiKey ?? null;
}

/** Enregistre la consommation d'une réponse de l'IA (sans jamais faire échouer l'appel). */
export function recordUsage(message: UsageLike, step: string): void {
  if (!message.usage || !message.model) return;
  const s = current.getStore();
  const input = message.usage.input_tokens ?? 0;
  const output = message.usage.output_tokens ?? 0;
  const cacheWrite = message.usage.cache_creation_input_tokens ?? 0;
  const cacheRead = message.usage.cache_read_input_tokens ?? 0;
  const cost = costOf(message.model, { input, output, cacheWrite, cacheRead });
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
      own_key: Boolean(s?.apiKey),
    });
    if (error) console.error("Consommation de l'IA non enregistrée :", error.message);
  })();
  if (s) s.pending.push(insert);
}
