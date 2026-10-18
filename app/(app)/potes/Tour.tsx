import Link from "next/link";
import { relativeDay } from "@/lib/dates";
import type { Tour } from "@/lib/potes";
import { PreviewCover } from "../../ui/PreviewCover";
import { Sleeve } from "../../ui/Sleeve";

const titles = (n: number) => `${n} titre${n > 1 ? "s" : ""}`;

/** Le tour des bacs : ce que chaque pote a rangé dans ses bacs partagés depuis le dernier tri (sinon ses derniers rangements). */
export function TourDesBacs({ tour }: { tour: Tour }) {
  if (tour.stops.length === 0) return null;
  return (
    <section id="tour" className="stack" style={{ gap: 8 }}>
      <div className="row between" style={{ alignItems: "baseline", padding: "4px 4px 0" }}>
        <h2 className="display display--s" style={{ fontSize: 20 }}>
          Le tour des bacs
        </h2>
        <span className="mono small muted">depuis {relativeDay(new Date(tour.since))}</span>
      </div>
      {tour.stops.map((stop) => {
        const tracks = stop.bacs
          .flatMap((b) => b.tracks.map((t) => ({ ...t, bac: b.name })))
          .sort((a, b) => Date.parse(b.liked_at) - Date.parse(a.liked_at));
        return (
          <article key={stop.poteId} className="panel">
            <div className="row between" style={{ alignItems: "baseline" }}>
              <b style={{ fontSize: 16 }}>{stop.name}</b>
              <span className="mono small">{stop.fresh > 0 ? `+${titles(stop.fresh)}` : "rien de neuf, ses derniers :"}</span>
            </div>
            <nav className="bin-row" style={{ margin: 0, padding: "0 0 4px" }} aria-label={`Bacs de ${stop.name}`}>
              {stop.bacs.map((b) => (
                <Link key={b.id} href={`/potes/bac/${b.id}`} className="bin-row__item" aria-label={stop.fresh > 0 ? `${b.name}, ${b.count} nouveaux` : b.name}>
                  <Sleeve name={b.sleeve} color={b.color} size={64} mark={b.mark} code={stop.fresh > 0 ? `+${b.count}` : undefined} />
                </Link>
              ))}
            </nav>
            <ul className="recent">
              {tracks.map((t) => (
                <li key={t.track_id} className="recent__item" style={{ background: "transparent", padding: "2px 0" }}>
                  <PreviewCover isrc={t.isrc} cover={t.cover_url} title={t.title} />
                  <span className="grow" style={{ minWidth: 0 }}>
                    <span className="recent__title" style={{ display: "block" }}>
                      {t.title} <span className="muted">· {t.artist}</span>
                    </span>
                    <span className="small muted" style={{ display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {t.bac} · {relativeDay(new Date(t.liked_at))}
                      {t.mine ? " · tu l'as" : ""}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </article>
        );
      })}
    </section>
  );
}
