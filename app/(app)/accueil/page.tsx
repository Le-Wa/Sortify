import Image from "next/image";
import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { activeBacs, lastTri, pendingQueue, recentlySorted } from "@/lib/daily";
import { hourOf, nextCron, relativeDay } from "@/lib/dates";
import { Sleeve } from "../../ui/Sleeve";
import { NewLikesButton } from "./NewLikesButton";
import { openSuggestions } from "@/lib/suggestions";
import { RecentList } from "./RecentList";
import { SuggestionCards } from "./SuggestionCards";

export default async function AccueilPage() {
  const member = await requireMember();
  const id = member.spotify_id;
  const [queue, tri, bacs, suggestions] = await Promise.all([pendingQueue(id), lastTri(id), activeBacs(id), openSuggestions(id)]);
  const lastDone = tri?.status === "done" ? tri : null;
  const recent = lastDone ? await recentlySorted(id, lastDone) : [];
  const added = new Map<string, number>();
  for (const item of recent) for (const b of item.bacs) added.set(b.id, (added.get(b.id) ?? 0) + 1);

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
            Le tri quotidien est en pause (Réglages).
          </p>
        ) : null}
      </section>

      {suggestions.length > 0 ? <SuggestionCards suggestions={suggestions} /> : null}

      {recent.length > 0 ? (
        <section className="stack" style={{ gap: 6 }}>
          <div className="row between" style={{ alignItems: "baseline", padding: "4px 4px 0" }}>
            <h2 className="display display--s" style={{ fontSize: 20 }}>
              Rangés {relativeDay(new Date(lastDone!.finished_at ?? lastDone!.started_at))}
            </h2>
            <span className="mono small muted">
              prochain tri {relativeDay(next)} {hourOf(next)}
            </span>
          </div>
          <RecentList items={recent} bacs={bacs.filter((b) => !b.is_divers).map((b) => ({ id: b.id, name: b.name, sleeve: b.sleeve_name ?? b.name, color: b.color, is_divers: false }))} />
        </section>
      ) : (
        <p className="small muted" style={{ margin: "0 4px" }}>
          {lastDone
            ? `Pas de nouveau like au dernier tri. Prochain tri ${relativeDay(next)} vers ${hourOf(next)}.`
            : "Sortify range tes nouveaux likes chaque matin. Tu peux aussi lancer un tri avec « Nouveaux likes ? »."}
        </p>
      )}

      <nav className="bin-row" aria-label="Tes bacs">
        {bacs
          .filter((b) => !b.is_divers)
          .map((b) => (
            <Link key={b.id} href={`/bacs/${b.id}`} className="bin-row__item" aria-label={`${b.name}${added.get(b.id) ? `, ${added.get(b.id)} nouveaux` : ""}`}>
              <Sleeve name={b.sleeve_name ?? b.name} color={b.color} size={76} code={added.get(b.id) ? `+${added.get(b.id)}` : undefined} />
            </Link>
          ))}
      </nav>
    </>
  );
}
