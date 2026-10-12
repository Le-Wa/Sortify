"use client";

import { useState, useTransition } from "react";
import type { Theme } from "@/lib/theme";
import { saveTheme } from "./actions";

const OPTIONS: { value: Theme; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "light", label: "Clair" },
  { value: "dark", label: "Sombre" },
];

/** Clair, sombre, ou comme le téléphone. */
export function ThemeSettings({ theme }: { theme: Theme }) {
  const [value, setValue] = useState(theme);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();

  function pick(next: Theme) {
    const previous = value;
    setValue(next);
    setError(null);
    // Effet immédiat, avant même la réponse du serveur.
    if (next === "auto") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", next);
    start(async () => {
      const result = await saveTheme(next).catch((e: unknown) => ({ ok: false as const, message: e instanceof Error ? e.message : "Erreur" }));
      if (!result.ok) {
        setValue(previous);
        setError(result.message);
      }
    });
  }

  return (
    <>
      <div className="segmented segmented--3" role="radiogroup" aria-label="Apparence">
        {OPTIONS.map((o) => (
          <button key={o.value} type="button" role="radio" aria-checked={value === o.value} className={`segmented__item ${value === o.value ? "is-on" : ""}`} onClick={() => pick(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
      {error ? (
        <p className="notice notice--error" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}
