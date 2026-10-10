"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Un seul extrait à la fois, résolu via Deezer au moment de l'écoute. */
export function usePreview() {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState<string | null>(null);

  useEffect(() => {
    const a = new Audio();
    a.addEventListener("ended", () => setPlaying(null));
    audio.current = a;
    return () => {
      a.pause();
      audio.current = null;
    };
  }, []);

  const toggle = useCallback(
    async (isrc: string | null) => {
      const a = audio.current;
      if (!a || !isrc) return;
      if (playing === isrc) {
        a.pause();
        setPlaying(null);
        return;
      }
      setUnavailable(null);
      setPlaying(isrc);
      try {
        const res = await fetch(`/api/preview?isrc=${encodeURIComponent(isrc)}`);
        const body = (await res.json()) as { preview?: string | null; error?: string };
        if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
        if (!body.preview) {
          setUnavailable(isrc);
          setPlaying(null);
          return;
        }
        a.src = body.preview;
        await a.play();
      } catch (error) {
        console.warn("Extrait indisponible :", error instanceof Error ? error.message : error);
        setUnavailable(isrc);
        setPlaying(null);
      }
    },
    [playing],
  );

  return { playing, unavailable, toggle };
}
