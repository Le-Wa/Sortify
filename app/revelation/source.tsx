"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useMemo } from "react";
import type { RevelationState } from "@/lib/revelation";
import { addCustomBac, createBacs, mergeBacs, otherIdea, renameBac, savePlaylists, setKept, type ActionResult } from "./actions";

/**
 * D'où les écrans de la Révélation tirent leur état et leurs actions : le serveur (par défaut),
 * ou une simulation sans Spotify ni IA (démo `/lab/onboarding`, développement seulement).
 */
export interface RevelationSource {
  /** État courant ; `retry` relance l'étape qui a échoué. */
  poll(retry: boolean): Promise<RevelationState>;
  /** L'étape a changé, ou une action a abouti : réafficher le bon écran avec des données fraîches. */
  advance(): void;
  /** Lien du bouton « Voir mes bacs » à la fin. */
  homeHref: string;
  actions: {
    setKept(id: string, keep: boolean): Promise<ActionResult>;
    renameBac(id: string, name: string): Promise<ActionResult>;
    otherIdea(id: string): Promise<ActionResult>;
    mergeBacs(firstId: string, secondId: string): Promise<ActionResult>;
    addCustomBac(request: string): Promise<ActionResult>;
    createBacs(): Promise<ActionResult>;
    savePlaylists(choices: unknown): Promise<ActionResult>;
  };
}

export const RevelationSourceContext = createContext<RevelationSource | null>(null);

async function pollServer(retry: boolean): Promise<RevelationState> {
  const res = await fetch(`/api/revelation${retry ? "?retry=1" : ""}`, { method: "POST" });
  if (!res.ok) {
    const failure = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(failure.error ?? `HTTP ${res.status}`);
  }
  return (await res.json()) as RevelationState;
}

const SERVER_ACTIONS: RevelationSource["actions"] = { setKept, renameBac, otherIdea, mergeBacs, addCustomBac, createBacs, savePlaylists };

export function useRevelationSource(): RevelationSource {
  const router = useRouter();
  const injected = useContext(RevelationSourceContext);
  const server = useMemo<RevelationSource>(
    () => ({ poll: pollServer, advance: () => router.refresh(), homeHref: "/accueil", actions: SERVER_ACTIONS }),
    [router],
  );
  return injected ?? server;
}
