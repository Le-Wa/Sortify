"use client";

import { useEffect, useState } from "react";
import { WAIT_TIPS } from "./content";

/** Pendant l'attente : une carte « coin du disquaire » qui change toutes les 9 s, selon l'étape en cours. */
export function WaitTips({ step, start = 0 }: { step: keyof typeof WAIT_TIPS; start?: number }) {
  const tips = WAIT_TIPS[step];
  const [i, setI] = useState(start);
  useEffect(() => {
    const timer = setInterval(() => setI((k) => k + 1), 9000);
    return () => clearInterval(timer);
  }, []);
  const tip = tips[i % tips.length];
  return (
    <aside className="tip" aria-live="polite">
      <span className="label">Coin du disquaire</span>
      <b className="tip__title">{tip.title}</b>
      <span className="tip__text">{tip.text}</span>
    </aside>
  );
}
