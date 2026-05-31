"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface StatusPayload {
  pct: number;
  step: string;
  imported: number;
  classified: number;
  inbox_count: number;
  onboarding_status: string;
}

type Props = {
  onJobStart?: () => void;
};

export default function SAppPreview({ onJobStart }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const jobStarted = useRef(false);

  useEffect(() => {
    if (!jobStarted.current) {
      jobStarted.current = true;
      fetch("/api/onboarding/jobs/start", { method: "POST" }).catch(() => {});
      onJobStart?.();
    }

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/onboarding/status");
        const data = (await res.json()) as StatusPayload;
        setStatus(data);

        if (data.step === "done" || data.onboarding_status === "complete") {
          clearInterval(pollRef.current!);
          router.refresh();
        }
        // If job budget was exhausted, retrigger it
        if (data.step !== "done" && data.onboarding_status !== "complete" && data.pct > 0) {
          // continue polling — job might still be running
        }
      } catch {}
    }, 3000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [onJobStart, router]);

  const isDone = status?.step === "done" || status?.onboarding_status === "complete";
  const pct = status?.pct ?? 0;

  if (isDone) return null;

  const stepLabels: Record<string, string> = {
    import: "Import en cours…",
    enrich: "Enrichissement des genres…",
    classify: "Classification…",
    done: "Terminé !",
  };
  const label = status ? (stepLabels[status.step] ?? "Traitement…") : "Démarrage…";

  return (
    <div className="ob-preview-banner">
      <div className="ob-preview-inner">
        <div className="ob-preview-text">
          <span className="ob-preview-label">{label}</span>
          {status && (
            <span className="ob-preview-counts">
              {status.classified > 0 ? `${status.classified} classifiés` : ""}
              {status.inbox_count > 0 ? ` · ${status.inbox_count} en inbox` : ""}
            </span>
          )}
        </div>
        <div className="ob-preview-bar">
          <div className="ob-preview-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}
