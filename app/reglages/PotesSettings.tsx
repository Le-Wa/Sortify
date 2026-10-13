"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { setBacShared, setShareBacs } from "../(app)/potes/actions";

/** Accord des potes : montrer ses bacs, et lesquels (jamais Divers). */
export function PotesSettings({ on, bacs }: { on: boolean; bacs: { id: string; name: string; shared: boolean }[] }) {
  const [share, setShare] = useState(on);
  const [shared, setShared] = useState(new Map(bacs.map((b) => [b.id, b.shared])));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function run(apply: () => void, revert: () => void, action: () => Promise<{ ok: boolean; message?: string }>) {
    setError(null);
    apply();
    start(async () => {
      const r = await action().catch((e: unknown) => ({ ok: false, message: e instanceof Error ? e.message : "Erreur" }));
      if (!r.ok) {
        revert();
        setError(r.message ?? "Erreur");
      }
    });
  }

  return (
    <div className="list">
      <div className="list__row">
        <span className="grow">
          Montrer mes bacs à mes potes
          <br />
          <span className="small muted">Et voir les leurs : affinité, bacs, bac commun.</span>
        </span>
        <button
          type="button"
          role="switch"
          className="switch"
          aria-label="Montrer mes bacs à mes potes"
          aria-checked={share}
          disabled={pending}
          onClick={() => run(() => setShare(!share), () => setShare(share), () => setShareBacs(!share))}
        />
      </div>
      {share
        ? bacs.map((b) => {
            const v = shared.get(b.id) ?? true;
            return (
              <div key={b.id} className="list__row">
                <span className="grow small">{b.name}</span>
                <button
                  type="button"
                  role="switch"
                  className="switch"
                  aria-label={`Montrer « ${b.name} »`}
                  aria-checked={v}
                  disabled={pending}
                  onClick={() =>
                    run(
                      () => setShared((m) => new Map(m).set(b.id, !v)),
                      () => setShared((m) => new Map(m).set(b.id, v)),
                      () => setBacShared(b.id, !v),
                    )
                  }
                />
              </div>
            );
          })
        : null}
      {share ? (
        <div className="list__row">
          <Link href="/potes" className="grow" style={{ fontWeight: 700 }}>
            Voir les potes ›
          </Link>
        </div>
      ) : null}
      {error ? (
        <p className="notice notice--error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
