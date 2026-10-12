"use client";

import { useState, useTransition } from "react";
import { WelcomeCard } from "../../ui/pedagogie/WelcomeCard";
import { closeWelcome } from "../actions";

/** Bienvenue, la première fois sur l'Accueil ; fermée, elle ne revient plus. */
export function Welcome({ nextTri }: { nextTri: string }) {
  const [open, setOpen] = useState(true);
  const [, start] = useTransition();
  if (!open) return null;
  return (
    <WelcomeCard
      nextTri={nextTri}
      onClose={() => {
        setOpen(false);
        start(async () => {
          await closeWelcome().catch((e: unknown) => console.error("Bienvenue :", e));
        });
      }}
    />
  );
}
