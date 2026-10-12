import Link from "next/link";
import { arrivals, WEEKS, type ArrivalTrack } from "@/lib/arrivages";
import { requireMember } from "@/lib/auth";
import { hourOf, nextCron, relativeDay } from "@/lib/dates";
import { weekKey, weekLabel } from "@/lib/weeks";
import { PreviewCover } from "../../ui/PreviewCover";
import { Sleeve } from "../../ui/Sleeve";

const SHOWN = 5;

function Tracks({ tracks }: { tracks: ArrivalTrack[] }) {
  return (
    <ul className="arrival__tracks">
      {tracks.slice(0, SHOWN).map((t) => (
        <li key={t.track_id}>
          <PreviewCover isrc={t.isrc} cover={t.cover_url} title={t.title} size={32} />
          <span className="recent__title">
            {t.title} <span className="muted">{t.artist}</span>
          </span>
        </li>
      ))}
      {tracks.length > SHOWN ? <li className="small muted">+ {tracks.length - SHOWN} autre{tracks.length - SHOWN > 1 ? "s" : ""}</li> : null}
    </ul>
  );
}

/** Arrivages : les likes de chaque semaine et les bacs où ils sont rangés. */
export default async function ArrivagesPage() {
  const member = await requireMember();
  const weeks = await arrivals(member.spotify_id);
  const thisWeek = weekKey(new Date());
  const next = nextCron();

  return (
    <>
      <header className="stack" style={{ gap: 4 }}>
        <h1 className="display">Arrivages</h1>
        <span className="small muted">
          Tes likes des {WEEKS} dernières semaines, et le bac où chacun est rangé. Prochain tri {relativeDay(next)} vers {hourOf(next)}.
        </span>
      </header>

      <div className="stack" style={{ gap: 8 }}>
        {weeks.map((week, i) => (
          <details key={week.key} className="arrival" open={i === 0 && week.total > 0}>
            <summary className="arrival__head">
              <span className="grow stack" style={{ gap: 2 }}>
                <b>{week.key === thisWeek ? "Cette semaine" : weekLabel(week.key)}</b>
                <span className="mono small muted">
                  {week.total === 0
                    ? "rien de neuf"
                    : `${week.total} like${week.total > 1 ? "s" : ""}${week.pending ? ` · ${week.pending} à trier` : ""}${week.divers.length ? ` · ${week.divers.length} en Divers` : ""}`}
                </span>
              </span>
              <span className="arrival__sleeves" aria-hidden="true">
                {week.bacs.slice(0, 4).map((b) => (
                  <Sleeve key={b.id} name={b.sleeve} color={b.color} size={30} mark={b.mark} />
                ))}
              </span>
              <span className="arrival__chevron" aria-hidden="true">
                ›
              </span>
            </summary>

            {week.total > 0 ? (
              <div className="stack arrival__body">
                {week.bacs.map((b) => (
                  <section key={b.id} className="stack" style={{ gap: 6 }}>
                    <Link href={`/bacs/${b.id}`} className="row arrival__bac">
                      <Sleeve name={b.sleeve} color={b.color} size={36} mark={b.mark} />
                      <span className="grow">{b.name}</span>
                      <span className="mono small">+{b.tracks.length}</span>
                    </Link>
                    <Tracks tracks={b.tracks} />
                  </section>
                ))}
                {week.divers.length ? (
                  <section className="stack" style={{ gap: 6 }}>
                    <Link href="/bacs/divers" className="row arrival__bac">
                      <span className="arrival__crate">Divers</span>
                      <span className="grow">Caisse Divers</span>
                      <span className="mono small">+{week.divers.length}</span>
                    </Link>
                    <Tracks tracks={week.divers} />
                  </section>
                ) : null}
                {week.pending ? (
                  <Link href="/a-trier" className="small" style={{ fontWeight: 700 }}>
                    {week.pending} titre{week.pending > 1 ? "s" : ""} t&apos;attend{week.pending > 1 ? "ent" : ""} dans « À trier » ›
                  </Link>
                ) : null}
              </div>
            ) : null}
          </details>
        ))}
      </div>
    </>
  );
}
