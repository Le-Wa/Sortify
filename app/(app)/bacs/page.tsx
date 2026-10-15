import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { bacStats, diversTracks, sleeperToShow, sleepingBacs } from "@/lib/bac-admin";
import { SleepingCard } from "./SleepingCard";
import { listBacs } from "@/lib/bacs";
import { BacList } from "./BacList";
import { NewBac } from "./NewBac";
import { markFor } from "@/lib/cover-shapes";

export default async function BacsPage() {
  const member = await requireMember();
  const [bacs, archived] = await Promise.all([listBacs(member.spotify_id, ["active"]), listBacs(member.spotify_id, ["archived"])]);
  const [stats, divers, asleep] = await Promise.all([
    bacStats(bacs.map((b) => b.id)),
    diversTracks(member.spotify_id, 1),
    sleepingBacs(member.spotify_id, bacs),
  ]);
  // Une seule carte à la fois : le bac qui dort depuis le plus longtemps, sauf si on l'a laissé dormir.
  const sleeper = sleeperToShow(bacs, asleep);
  const total = [...stats.values()].reduce((n, s) => n + s.total, 0);

  return (
    <>
      <header className="row between" style={{ alignItems: "flex-end" }}>
        <h1 className="display">Tes bacs</h1>
        <span className="mono small" style={{ textAlign: "right" }}>
          {bacs.length} bacs
          <br />
          {total.toLocaleString("fr-FR")} titres
        </span>
      </header>
      {sleeper ? (
        <SleepingCard
          bac={{ id: sleeper.id, name: sleeper.name, sleeve: sleeper.sleeve_name ?? sleeper.name, color: sleeper.color, mark: markFor(sleeper), weeks: asleep.get(sleeper.id)! }}
        />
      ) : null}
      <BacList
        bacs={bacs.map((b) => ({
          id: b.id,
          name: b.name,
          sleeve: b.sleeve_name ?? b.name,
          color: b.color,
          mark: markFor(b),
          autoFill: b.auto_fill,
          total: stats.get(b.id)?.total ?? 0,
          week: stats.get(b.id)?.week ?? 0,
          asleep: asleep.get(b.id) ?? null,
        }))}
      />
      <NewBac
        archived={archived.map((b) => ({ id: b.id, name: b.name, sleeve: b.sleeve_name ?? b.name, color: b.color, mark: markFor(b), pitch: b.pitch }))}
      />
      <Link href="/bacs/divers" className="crate-card">
        <span className="crate-card__label">
          Caisse
          <br />
          Divers
        </span>
        <span className="grow" style={{ fontSize: 13, lineHeight: 1.3 }}>
          <b>{divers.total} titres</b> attendent leur bac.
        </span>
        <span aria-hidden="true" style={{ fontSize: 20 }}>
          ›
        </span>
      </Link>
    </>
  );
}
