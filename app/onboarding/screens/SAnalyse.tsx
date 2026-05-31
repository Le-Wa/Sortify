"use client";

import { useState, useEffect, useRef } from "react";

type Props = {
  onEnter: () => void;
  onBack: () => void;
};

interface StatusPayload {
  imported: number;
  classified: number;
  pct: number;
  step: string;
}

export default function SAnalyse({ onEnter, onBack }: Props) {
  const [status, setStatus] = useState<StatusPayload | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Start job immediately on mount
    fetch("/api/onboarding/jobs/start", { method: "POST" }).catch(() => {});

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/onboarding/status");
        const data = (await res.json()) as StatusPayload;
        setStatus(data);

        if (data.step === "done") {
          clearInterval(pollRef.current!);
        }
      } catch {}
    }, 2000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const total = status?.imported ?? 0;
  const done = status?.classified ?? 0;

  return (
    <div className="ob-screen">
      <button className="ob-back" onClick={onBack}>← Retour</button>
      <h2 className="ob-step-title">Analyse de ta bibliothèque</h2>
      <p className="ob-step-desc">
        Sortify analyse tes liked songs pour trouver la meilleure organisation.
      </p>

      <div className="ob-progress-block">
        <div className="ob-counter">
          {total > 0 ? `${done} / ${total}` : "Démarrage…"}
        </div>
        {total > 0 && (
          <div className="ob-progress-bar">
            <div
              className="ob-progress-fill"
              style={{ width: `${Math.round((done / total) * 100)}%` }}
            />
          </div>
        )}
      </div>

      <button className="s-btn s-btn-primary ob-cta" onClick={onEnter}>
        Entrer dans l&apos;app maintenant →
      </button>
    </div>
  );
}
