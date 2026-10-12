"use client";

import Image from "next/image";
import { useState, useSyncExternalStore } from "react";

/** Un seul extrait à la fois sur toute la page, résolu via Deezer (ISRC) au moment de l'écoute. */
let audio: HTMLAudioElement | null = null;
let current: string | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

async function toggle(isrc: string): Promise<boolean> {
  audio ??= new Audio();
  if (current === isrc) {
    audio.pause();
    current = null;
    emit();
    return true;
  }
  audio.pause();
  current = isrc;
  emit();
  const res = await fetch(`/api/preview?isrc=${encodeURIComponent(isrc)}`);
  const body = (await res.json()) as { preview?: string | null; error?: string };
  if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
  if (current !== isrc) return true; // un autre titre a été touché entre-temps
  if (!body.preview) {
    current = null;
    emit();
    return false;
  }
  audio.src = body.preview;
  audio.onended = () => {
    current = null;
    emit();
  };
  await audio.play();
  return true;
}

/** Pochette d'un titre : la toucher lance (ou arrête) un extrait de 30 s. */
export function PreviewCover({ isrc, cover, title, size = 44 }: { isrc: string | null; cover: string | null; title: string; size?: number }) {
  const playing = useSyncExternalStore(subscribe, () => isrc !== null && current === isrc, () => false);
  const [unavailable, setUnavailable] = useState(false);
  const image = cover ? <Image src={cover} alt="" fill sizes={`${size}px`} /> : null;
  if (!isrc) {
    return (
      <span className="recent__cover" style={{ width: size, height: size }}>
        {image}
      </span>
    );
  }
  return (
    <button
      type="button"
      className={`recent__cover cover-play ${playing ? "is-playing" : ""}`}
      style={{ width: size, height: size }}
      aria-label={unavailable ? `Pas d'extrait pour ${title}` : playing ? `Arrêter l'extrait de ${title}` : `Écouter un extrait de ${title}`}
      aria-pressed={playing}
      onClick={() => {
        setUnavailable(false);
        toggle(isrc)
          .then((ok) => setUnavailable(!ok))
          .catch((e: unknown) => {
            console.warn("Extrait indisponible :", e instanceof Error ? e.message : e);
            setUnavailable(true);
            current = null;
            emit();
          });
      }}
    >
      {image}
      <span className="cover-play__icon" aria-hidden="true">
        {unavailable ? "—" : playing ? "❚❚" : "▶"}
      </span>
    </button>
  );
}
