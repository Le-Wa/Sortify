"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface StatusPayload {
  pct: number;
  step: string;
  onboarding_status: string;
  classified: number;
  inbox_count: number;
}

const STEP_LABELS: Record<string, string> = {
  idle: "Préparation…",
  import: "Import en cours…",
  enrich: "Enrichissement des genres…",
  classify: "Classification…",
  done: "Terminé !",
};

export default function OnboardingBanner() {
  const router = useRouter();
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    async function poll() {
      try {
        const res = await fetch("/api/onboarding/status");
        if (!res.ok) return;
        const data = (await res.json()) as StatusPayload;
        setStatus(data);

        if (data.step === "done" || data.onboarding_status === "complete") {
          clearInterval(pollRef.current!);
          setTimeout(() => setDismissed(true), 3000);
          router.refresh();
        }
      } catch {}
    }

    poll();
    pollRef.current = setInterval(poll, 3000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [router]);

  if (dismissed || !status) return null;
  if (status.onboarding_status === "complete" && !status.pct) return null;

  const isDone = status.step === "done" || status.onboarding_status === "complete";
  const label = isDone ? "Sortify est prêt !" : (STEP_LABELS[status.step] ?? "Traitement…");
  const pct = status.pct;

  return (
    <div className="ob-banner" role="status" aria-live="polite">
      <div className="ob-banner-inner">
        <span className="ob-banner-label">{label}</span>
        {!isDone && status.classified > 0 && (
          <span className="ob-banner-meta">{status.classified} classifiés</span>
        )}
        {!isDone && status.inbox_count > 0 && (
          <span className="ob-banner-meta">{status.inbox_count} en inbox</span>
        )}
        <div className="ob-banner-bar">
          <div
            className="ob-banner-fill"
            style={{ width: `${pct}%`, transition: "width 0.5s ease" }}
          />
        </div>
        {isDone && (
          <button className="ob-banner-close" onClick={() => setDismissed(true)}>
            ×
          </button>
        )}
      </div>
    </div>
  );
}
