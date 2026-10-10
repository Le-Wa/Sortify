"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { RevelationState } from "@/lib/revelation";

const POLL_MS = 1500;

/**
 * Suit l'état de la Révélation tant qu'un job tourne. Quand l'étape change,
 * la page serveur est rechargée pour afficher le bon écran.
 */
export function useRevelation(
  stage: RevelationState["stage"] | RevelationState["stage"][],
  keepPolling: (s: RevelationState) => boolean,
) {
  const router = useRouter();
  const stagesKey = (Array.isArray(stage) ? stage : [stage]).join(",");
  const [state, setState] = useState<RevelationState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  const retryNext = useRef(false);
  const keep = useRef(keepPolling);
  useEffect(() => {
    keep.current = keepPolling;
  });

  const poll = useCallback(async (): Promise<boolean> => {
    const retry = retryNext.current;
    retryNext.current = false;
    try {
      const res = await fetch(`/api/revelation${retry ? "?retry=1" : ""}`, { method: "POST" });
      if (!res.ok) {
        const failure = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(failure.error ?? `HTTP ${res.status}`);
      }
      const body = (await res.json()) as RevelationState;
      setError(null);
      if (!stagesKey.split(",").includes(body.stage)) {
        router.refresh();
        return false;
      }
      setState(body);
      return keep.current(body);
    } catch (e) {
      setError(`Connexion au serveur perdue (${e instanceof Error ? e.message : "erreur inconnue"}). On réessaie…`);
      return true;
    }
  }, [router, stagesKey]);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const loop = async () => {
      const again = await poll();
      if (alive && again) timer = setTimeout(loop, POLL_MS);
    };
    void loop();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [poll, round]);

  const retry = useCallback(() => {
    retryNext.current = true;
    setRound((r) => r + 1);
  }, []);
  /** Reprend le suivi (après une action qui relance un job). */
  const resume = useCallback(() => setRound((r) => r + 1), []);

  return { state, error, retry, resume };
}
