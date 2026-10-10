"use client";

import { useEffect, useRef } from "react";

/** Panneau qui monte du bas (mobile-first : plutôt qu'une modale). Fermeture : Échap, fond, ou bouton. */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-label={title}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="sheet__body">
        <div className="row between">
          <h2 className="display display--s">{title}</h2>
          <button type="button" className="btn btn--quiet btn--sm" onClick={onClose}>
            Fermer
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
