"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RevelationState } from "@/lib/revelation";
import { useRevelationSource } from "./source";

const POLL_MS = 1500;

/**
 * Suit l'état de la Révélation tant qu'un job tourne. Quand l'étape change,
 * la page est rechargée pour afficher le bon écran (via la source : serveur ou démo).
 */
export function useRevelation(
  stage: RevelationState["stage"] | RevelationState["stage"][],
  keepPolling: (s: RevelationState) => boolean,
) {
  const source = useRevelationSource();
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
      const body = await source.poll(retry);
      setError(null);
      if (!stagesKey.split(",").includes(body.stage)) {
        source.advance();
        return false;
      }
      setState(body);
      return keep.current(body);
    } catch (e) {
      setError(`Connexion au serveur perdue (${e instanceof Error ? e.message : "erreur inconnue"}). On réessaie…`);
      return true;
    }
  }, [source, stagesKey]);

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
