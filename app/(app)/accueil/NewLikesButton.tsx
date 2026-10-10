"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import type { TriProgress } from "@/lib/tri";
import { sortNow } from "../actions";

type TriStatus = { status: "running" | "done" | "failed"; progress: TriProgress; error: string | null } | null;

/** Lance un tri tout de suite et suit sa progression jusqu'au bout. */
export function NewLikesButton({ paused }: { paused: boolean }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!running) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const res = await fetch("/api/tri", { method: "POST" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const job = (await res.json()) as TriStatus;
        if (!alive) return;
        if (job && job.status !== "running") {
          setRunning(false);
          if (job.status === "failed") setMessage(`Le tri a échoué : ${job.error ?? "erreur inconnue"}`);
          else {
            const p = job.progress;
            setMessage(
              p.fetched === 0
                ? "Pas de nouveau like."
                : `${p.fetched} nouveau${p.fetched > 1 ? "x" : ""} like${p.fetched > 1 ? "s" : ""} : ${p.placed} rangé${p.placed > 1 ? "s" : ""}, ${p.pending} à trier.`,
            );
          }
          router.refresh();
          return;
        }
      } catch (e) {
        setMessage(`Suivi du tri interrompu (${e instanceof Error ? e.message : "erreur"}). On réessaie…`);
      }
      if (alive) timer = setTimeout(poll, 1500);
    };
    timer = setTimeout(poll, 1000);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [running, router]);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 6000);
    return () => clearTimeout(timer);
  }, [message]);

  return (
    <>
      <button
        type="button"
        className="btn btn--ghost btn--sm nowrap"
        disabled={running}
        aria-label="Chercher les nouveaux likes maintenant"
        onClick={() => {
          setMessage(null);
          setRunning(true);
          startTransition(async () => {
            const result = await sortNow().catch((e: unknown) => ({ ok: false as const, message: e instanceof Error ? e.message : "Erreur" }));
            if (!result.ok) {
              setRunning(false);
              setMessage(result.message);
            }
          });
        }}
      >
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={running ? "spin" : undefined}>
          <path d="M21 12a9 9 0 11-3-6.7" />
          <path d="M21 4v5h-5" />
        </svg>
        {running ? (
          "On cherche…"
        ) : (
          <>
            Nouveaux<span className="wide-only"> likes</span> ?
          </>
        )}
      </button>
      {message ? (
        <p className="toast" role="status">
          {message}
          {paused ? " (Le tri quotidien est en pause.)" : ""}
        </p>
      ) : null}
    </>
  );
}
