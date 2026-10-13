"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { SleeveMark } from "@/lib/cover-shapes";
import { Sleeve } from "../../ui/Sleeve";
import { sleepOn } from "./actions";

/** « Ce bac dort » : un état calme, sans animation ; trois sorties, dont « Laisser dormir » (8 semaines). */
export function SleepingCard({ bac }: { bac: { id: string; name: string; sleeve: string; color: string; mark: SleeveMark; weeks: number } }) {
  const [hidden, setHidden] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (hidden) return null;
  return (
    <section className="suggestion card">
      <Sleeve name={bac.sleeve} color={bac.color} size={64} mark={bac.mark} />
      <div className="grow stack" style={{ gap: 6 }}>
        <b style={{ fontSize: 15, lineHeight: 1.25 }}>« {bac.name} » dort</b>
        <span style={{ fontSize: 13, lineHeight: 1.35 }}>Aucun titre depuis {bac.weeks} semaines. Tes likes ne passent plus par là ?</span>
        <span className="row" style={{ gap: 6, flexWrap: "wrap" }}>
          <Link href={`/bacs/${bac.id}#ajuster`} className="btn btn--sm">
            L&apos;élargir
          </Link>
          <Link href={`/bacs/${bac.id}#retirer`} className="btn btn--ghost btn--sm">
            Le retirer
          </Link>
          <button
            type="button"
            className="btn btn--quiet btn--sm"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const result = await sleepOn(bac.id).catch((e: unknown) => ({ ok: false as const, message: e instanceof Error ? e.message : "Erreur" }));
                if (result.ok) setHidden(true);
                else setError(result.message);
              })
            }
          >
            Laisser dormir
          </button>
        </span>
        {error ? (
          <span className="small" role="alert" style={{ color: "var(--accent)" }}>
            {error}
          </span>
        ) : null}
      </div>
    </section>
  );
}
