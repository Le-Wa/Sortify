"use client";

import { useEffect, useState, useTransition } from "react";
import { subscribePush, testPush, unsubscribePush } from "./actions";

type State = "loading" | "unsupported" | "install" | "denied" | "off" | "on";

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

/** « Prévenir le lundi » : une notification quand l'arrivage de la semaine est prêt. */
export function NotifyCard({ publicKey }: { publicKey: string }) {
  const [state, setState] = useState<State>("loading");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    let cancelled = false;
    async function detect(): Promise<State> {
      const ios = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const installed = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) return ios && !installed ? "install" : "unsupported";
      if (Notification.permission === "denied") return "denied";
      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
      return (await registration.pushManager.getSubscription()) ? "on" : "off";
    }
    detect()
      .then((s) => !cancelled && setState(s))
      .catch((e: unknown) => {
        console.error("Notifications :", e);
        if (!cancelled) setState("unsupported");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function enable() {
    setMessage(null);
    start(async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        const sub = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });
        const result = await subscribePush(sub.toJSON());
        if (!result.ok) throw new Error(result.message);
        setState("on");
      } catch (e) {
        setState(Notification.permission === "denied" ? "denied" : "off");
        setMessage({ ok: false, text: e instanceof Error ? e.message : "Activation impossible." });
      }
    });
  }

  function disable() {
    setMessage(null);
    start(async () => {
      try {
        const sub = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
        if (sub) {
          await unsubscribePush(sub.endpoint);
          await sub.unsubscribe();
        }
        setState("off");
      } catch (e) {
        setMessage({ ok: false, text: e instanceof Error ? e.message : "Désactivation impossible." });
      }
    });
  }

  function test() {
    setMessage(null);
    start(async () => {
      const result = await testPush().catch((e: unknown) => ({ ok: false as const, message: e instanceof Error ? e.message : "Erreur" }));
      setMessage(result.ok ? { ok: true, text: "Notification envoyée." } : { ok: false, text: result.message });
    });
  }

  return (
    <div className="panel">
      <span className="row between">
        <b style={{ fontSize: 15 }}>Prévenir le lundi</b>
        {state === "on" ? <span className="mono small">activé</span> : null}
      </span>
      <span className="small muted">Une notification sur ce téléphone quand ton arrivage de la semaine est rangé.</span>
      {state === "install" ? (
        <span className="small">
          Sur iPhone, ajoute d&apos;abord Sortify à l&apos;écran d&apos;accueil : bouton Partager, puis « Sur l&apos;écran d&apos;accueil ». Ouvre Sortify depuis
          l&apos;icône et reviens ici.
        </span>
      ) : null}
      {state === "unsupported" ? <span className="small">Ce navigateur ne gère pas les notifications.</span> : null}
      {state === "denied" ? <span className="small">Les notifications sont bloquées pour Sortify dans les réglages du téléphone.</span> : null}
      {state === "off" ? (
        <button type="button" className="btn btn--sm" disabled={pending} onClick={enable}>
          {pending ? "…" : "Activer les notifications"}
        </button>
      ) : null}
      {state === "on" ? (
        <span className="row" style={{ gap: 8 }}>
          <button type="button" className="btn btn--ghost btn--sm" disabled={pending} onClick={test}>
            Essayer
          </button>
          <button type="button" className="btn btn--quiet btn--sm" disabled={pending} onClick={disable}>
            Désactiver
          </button>
        </span>
      ) : null}
      {message ? (
        <p className={`notice ${message.ok ? "" : "notice--error"}`} role={message.ok ? "status" : "alert"}>
          {message.text}
        </p>
      ) : null}
    </div>
  );
}
