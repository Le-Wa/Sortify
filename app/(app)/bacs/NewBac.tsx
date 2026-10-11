"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { BottomSheet } from "../../ui/BottomSheet";
import { createBac } from "./actions";

interface BacJob {
  id: string;
  status: "running" | "done" | "failed";
  error: string | null;
  progress: {
    phase: "fiche" | "remplissage" | "playlist" | "done";
    scanned: number;
    total: number;
    found: number;
    name: string | null;
    bac?: { id: string; name: string; count: number };
    phaseStartedAt?: string;
  };
}

const SEGMENTS = 30;
const POLL_MS = 1500;

/** Part de la jauge de chaque étape ; les étapes faites d'un seul appel long avancent au temps écoulé. */
const STEPS = {
  fiche: { from: 0, to: 0.2, seconds: 35, text: "L'IA écrit la fiche de ton bac…" },
  remplissage: { from: 0.2, to: 0.85, seconds: 0, text: "Elle cherche les titres dans toute ta bibliothèque…" },
  playlist: { from: 0.85, to: 1, seconds: 40, text: "On crée la playlist et sa pochette dans Spotify…" },
} as const;

function ratioOf(job: BacJob): number {
  const p = job.progress;
  if (p.phase === "done") return 1;
  const s = STEPS[p.phase];
  let share: number;
  if (p.phase === "remplissage") share = p.total ? p.scanned / p.total : 0;
  else {
    const elapsed = p.phaseStartedAt ? Math.max(0, (Date.now() - Date.parse(p.phaseStartedAt)) / 1000) : 0;
    share = 1 - Math.exp(-elapsed / s.seconds);
  }
  return s.from + (s.to - s.from) * share;
}

async function fetchJob(): Promise<BacJob | null> {
  const res = await fetch("/api/bac", { method: "POST" });
  if (!res.ok) throw new Error(`Suivi du nouveau bac : HTTP ${res.status}`);
  return (await res.json()) as BacJob | null;
}

/** « + Nouveau bac » : une description libre ; l'IA crée le bac en tâche de fond, suivi ici étape par étape. */
export function NewBac() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<BacJob | null>(null);
  // On ne suit (et n'annonce la fin) que d'une création vue en cours pendant cette visite.
  const [watching, setWatching] = useState(false);
  const [pending, startTransition] = useTransition();

  const poll = useCallback(async () => {
    try {
      const next = await fetchJob();
      setJob(next);
      if (next?.status === "running") setWatching(true);
      if (next && next.status !== "running") router.refresh();
    } catch (e) {
      console.error(e);
    }
  }, [router]);

  // Une création lancée plus tôt (app fermée entre-temps) est reprise à l'ouverture de la page.
  useEffect(() => {
    let cancelled = false;
    fetchJob()
      .then((j) => {
        if (cancelled || j?.status !== "running") return;
        setJob(j);
        setWatching(true);
      })
      .catch((e: unknown) => console.error(e));
    return () => {
      cancelled = true;
    };
  }, []);

  const running = watching && job?.status === "running";
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => void poll(), POLL_MS);
    return () => clearInterval(timer);
  }, [running, poll]);

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await createBac(text).catch((e: unknown) => ({ ok: false as const, message: e instanceof Error ? e.message : "Erreur" }));
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setOpen(false);
      setText("");
      setWatching(true);
      setJob({
        id: "",
        status: "running",
        error: null,
        progress: { phase: "fiche", scanned: 0, total: 0, found: 0, name: null, phaseStartedAt: new Date().toISOString() },
      });
    });
  }

  if (watching && job) {
    const p = job.progress;
    if (job.status === "failed") {
      return (
        <div className="notice notice--error stack" role="alert">
          <span>La création du bac s&apos;est arrêtée : {job.error ?? "erreur inconnue"}</span>
          <button type="button" className="btn btn--sm" onClick={() => setWatching(false)}>
            Fermer
          </button>
        </div>
      );
    }
    if (job.status === "done" && p.bac) {
      return (
        <div className="notice stack" role="status">
          <span>
            « {p.bac.name} » est prêt : {p.bac.count} titre{p.bac.count > 1 ? "s" : ""}, et sa playlist est dans Spotify.
          </span>
          <div className="row" style={{ gap: 8 }}>
            <Link href={`/bacs/${p.bac.id}`} className="btn btn--sm">
              Voir le bac
            </Link>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setWatching(false)}>
              OK
            </button>
          </div>
        </div>
      );
    }
    const filled = Math.round(ratioOf(job) * SEGMENTS);
    const step = p.phase === "done" ? STEPS.playlist : STEPS[p.phase];
    return (
      <section className="panel stack" aria-busy="true" style={{ gap: 8 }}>
        <span className="label">Nouveau bac{p.name ? ` · ${p.name}` : ""}</span>
        <div className="segments" aria-hidden="true">
          {Array.from({ length: SEGMENTS }, (_, i) => (
            <span key={i} className={i < filled ? "on" : i === filled ? "now" : undefined} />
          ))}
        </div>
        <span role="status" style={{ fontSize: 14 }}>
          {step.text}
        </span>
        {p.phase === "remplissage" && p.total ? (
          <span className="mono small">
            {p.scanned.toLocaleString("fr-FR")} / {p.total.toLocaleString("fr-FR")} titres écoutés · {p.found} trouvé{p.found > 1 ? "s" : ""}
          </span>
        ) : null}
        <span className="small muted">Tu peux fermer l&apos;app : on continue sans toi.</span>
      </section>
    );
  }

  return (
    <>
      <button type="button" className="btn btn--ghost" onClick={() => setOpen(true)}>
        + Nouveau bac
      </button>

      <BottomSheet open={open} onClose={() => setOpen(false)} title="Nouveau bac">
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <textarea
            className="textarea"
            rows={3}
            maxLength={500}
            value={text}
            disabled={pending}
            onChange={(e) => setText(e.target.value)}
            placeholder="Ex. : le rap US des années 2000 ; ce que j'écoute en courant ; Kalash et la Martinique"
            aria-label="Décris ton nouveau bac"
          />
          <p className="small muted" style={{ margin: 0 }}>
            L&apos;IA écrit la fiche, cherche les titres dans toute ta bibliothèque et crée la playlist dans Spotify. Compte 1 à 2 minutes ; tu
            pourras suivre l&apos;avancée ici.
          </p>
          {error ? (
            <p className="notice notice--error" role="alert">
              {error}
            </p>
          ) : null}
          <button type="submit" className="btn" disabled={pending || text.trim().length < 3}>
            {pending ? "C'est parti…" : "Créer le bac"}
          </button>
        </form>
      </BottomSheet>
    </>
  );
}
