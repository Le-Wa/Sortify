import Image from "next/image";
import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { activeBacs, chip, failedTri, lastTri, pendingQueue, weekArrival } from "@/lib/daily";
import { hourOf, nextCron, relativeDay } from "@/lib/dates";
import { Sleeve } from "../../ui/Sleeve";
import { NewLikesButton } from "./NewLikesButton";
import { openSuggestions } from "@/lib/suggestions";
import { RecentList } from "./RecentList";
import { SuggestionCards } from "./SuggestionCards";
import { markFor } from "@/lib/cover-shapes";

/** Titres de l'arrivage montrés sur l'Accueil ; la suite est dans Arrivages. */
const SHOWN = 10;

export default async function AccueilPage() {
  const member = await requireMember();
  const id = member.spotify_id;
  const [queue, tri, bacs, suggestions, arrival, failure] = await Promise.all([
    pendingQueue(id),
    lastTri(id),
    activeBacs(id),
    openSuggestions(id),
    weekArrival(id),
    failedTri(id),
  ]);
  const lastDone = tri?.status === "done" ? tri : null;
  const recent = arrival.items;
  // Rangée de pochettes : seulement les bacs qui ont reçu des titres cette semaine.
  const added = new Map<string, number>();
  for (const item of recent) for (const b of item.bacs) added.set(b.id, (added.get(b.id) ?? 0) + 1);
  const servedBacs = bacs.filter((b) => !b.is_divers && added.has(b.id)).sort((a, b) => added.get(b.id)! - added.get(a.id)!);

  const next = nextCron();
  const pending = queue.length;
  const triLabel = lastDone
    ? `Tri ${relativeDay(new Date(lastDone.finished_at ?? lastDone.started_at))} ${hourOf(new Date(lastDone.finished_at ?? lastDone.started_at))} · ${lastDone.progress.placed} rangé${lastDone.progress.placed > 1 ? "s" : ""}`
    : `Premier tri ${relativeDay(next)} vers ${hourOf(next)}`;

  return (
    <>
      <header className="row between">
        <span className="display display--s">Sortify</span>
        <span className="row" style={{ gap: 8 }}>
          <NewLikesButton paused={member.sort_paused} />
          <Link href="/reglages" className="icon-btn" aria-label="Réglages">
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
              <circle cx="16" cy="7" r="2" />
              <circle cx="8" cy="17" r="2" />
            </svg>
          </Link>
        </span>
      </header>

      <section className="counter home-counter">
        <div className="row between" style={{ alignItems: "flex-start", gap: 10 }}>
          <div className="stack" style={{ gap: 8 }}>
            <span className="label">{triLabel}</span>
            <h1 className="display" style={{ fontSize: 44 }}>
              {pending > 0 ? (
                <>
                  {pending} disque{pending > 1 ? "s" : ""}
                  <br />
                  sur le
                  <br />
                  comptoir.
                </>
              ) : (
                <>
                  Tout est
                  <br />
                  rangé.
                </>
              )}
            </h1>
          </div>
          {pending > 0 ? (
            <div className="pile" aria-hidden="true">
              {queue.slice(0, 3).map((q, i) => (
                <span key={q.track_id} className={`pile__item pile__item--${i}`}>
                  {q.cover_url ? <Image src={q.cover_url} alt="" fill sizes="96px" /> : null}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        {pending > 0 ? (
          <Link href="/a-trier" className="btn btn--accent">
            Les ranger
          </Link>
        ) : member.sort_paused ? (
          <p className="small muted" style={{ margin: 0 }}>
            Le tri du lundi est en pause (Réglages).
          </p>
        ) : null}
      </section>

      {failure ? (
        <p className="notice notice--error" role="alert">
          Le dernier tri ({relativeDay(new Date(failure.at))} {hourOf(new Date(failure.at))}) n&apos;a pas pu se faire : {failure.error}. Touche « Nouveaux likes ? » pour le relancer.
        </p>
      ) : null}

      {suggestions.length > 0 ? <SuggestionCards suggestions={suggestions} /> : null}

      {servedBacs.length > 0 ? (
        <nav className="bin-row" aria-label="Bacs servis cette semaine">
          {servedBacs.map((b) => (
            <Link key={b.id} href={`/bacs/${b.id}`} className="bin-row__item" aria-label={`${b.name}, ${added.get(b.id)} nouveaux`}>
              <Sleeve name={b.sleeve_name ?? b.name} color={b.color} size={76} mark={markFor(b)} code={`+${added.get(b.id)}`} />
            </Link>
          ))}
        </nav>
      ) : null}

      {recent.length > 0 ? (
        <section className="stack" style={{ gap: 6 }}>
          <div className="row between" style={{ alignItems: "baseline", padding: "4px 4px 0" }}>
            <h2 className="display display--s" style={{ fontSize: 20 }}>
              Arrivage de la semaine
            </h2>
            <Link href="/arrivages" className="mono small">
              {recent.length} titre{recent.length > 1 ? "s" : ""} ›
            </Link>
          </div>
          <RecentList items={recent.slice(0, SHOWN)} bacs={bacs.filter((b) => !b.is_divers).map((b) => ({ ...chip(b), is_divers: false }))} />
          {recent.length > SHOWN ? (
            <Link href="/arrivages" className="btn btn--ghost btn--sm">
              Voir les {recent.length} titres de la semaine
            </Link>
          ) : null}
        </section>
      ) : null}
      <p className="small muted" style={{ margin: "0 4px" }}>
        {arrival.waiting > 0
          ? `${arrival.waiting} like${arrival.waiting > 1 ? "s attendent" : " attend"} le tri ${relativeDay(next) === "aujourd'hui" ? "de ce matin" : relativeDay(next) === "demain" ? "de demain" : `de ${relativeDay(next)}`} (vers ${hourOf(next)}), ou « Nouveaux likes ? » pour ranger tout de suite.`
          : recent.length > 0
            ? `Prochain tri ${relativeDay(next)} vers ${hourOf(next)}.`
            : lastDone
              ? `Pas de nouveau like cette semaine. Prochain tri ${relativeDay(next)} vers ${hourOf(next)}.`
              : "Sortify range tes nouveaux likes chaque lundi. Tu peux aussi lancer un tri avec « Nouveaux likes ? »."}
      </p>
    </>
  );
}
