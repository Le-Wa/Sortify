import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { diversTracks } from "@/lib/bac-admin";
import { listBacs } from "@/lib/bacs";
import { DiversList } from "./DiversList";

const SHOWN = 100;

export default async function DiversPage() {
  const member = await requireMember();
  const [divers, bacs] = await Promise.all([diversTracks(member.spotify_id, SHOWN), listBacs(member.spotify_id, ["active"])]);
  return (
    <>
      <Link href="/bacs" className="back">
        ‹ Bacs
      </Link>
      <div className="crate-card" style={{ flexDirection: "column", alignItems: "flex-start", gap: 8 }}>
        <span className="label">Fragile · à trier un jour</span>
        <h1 className="crate-card__label" style={{ fontSize: 50, margin: 0 }}>
          Caisse
          <br />
          Divers
        </h1>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.4 }}>
          <b>{divers.total} titres</b> attendent leur bac. Dès que plusieurs vont ensemble, Sortify te propose un nouveau bac.
        </p>
      </div>
      <DiversList
        tracks={divers.tracks}
        bacs={bacs.map((b) => ({ id: b.id, name: b.name, sleeve: b.sleeve_name ?? b.name, color: b.color, is_divers: false }))}
      />
      {divers.total > SHOWN ? (
        <p className="small muted" style={{ margin: 0, textAlign: "center" }}>
          {`Les ${SHOWN} plus récents sur ${divers.total}.`}
        </p>
      ) : null}
    </>
  );
}
