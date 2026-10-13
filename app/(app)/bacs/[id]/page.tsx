import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { bacStats, bacTracks } from "@/lib/bac-admin";
import { getBac } from "@/lib/bacs";
import { markFor } from "@/lib/cover-shapes";
import { BacDetail } from "./BacDetail";
import { SleeveEditor } from "./SleeveEditor";
import { PlayOrder } from "./PlayOrder";

export default async function BacPage(props: PageProps<"/bacs/[id]">) {
  const member = await requireMember();
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const bac = await getBac(member.spotify_id, id);
  if (!bac || bac.status !== "active" || bac.is_divers) notFound();
  const [stats, tracks] = await Promise.all([bacStats([bac.id]), bacTracks(member.spotify_id, bac.id, 40)]);
  const s = stats.get(bac.id) ?? { total: 0, week: 0 };

  return (
    <>
      <Link href="/bacs" className="back">
        ‹ Bacs
      </Link>
      <div className="row" style={{ gap: 16, alignItems: "flex-end" }}>
        <SleeveEditor bac={{ id: bac.id, name: bac.name, sleeve: bac.sleeve_name ?? bac.name, color: bac.color, mark: markFor(bac) }} />
        <div className="grow stack" style={{ gap: 6 }}>
          <h1 className="display display--s" style={{ fontSize: 24 }}>
            {bac.name}
          </h1>
          <span className="mono small">
            {s.total} titres · {s.week > 0 ? `+${s.week}` : "0"} cette semaine
          </span>
          <span style={{ fontSize: 14, lineHeight: 1.3 }}>{bac.pitch}</span>
          {bac.spotify_playlist_id ? (
            <a href={`https://open.spotify.com/playlist/${bac.spotify_playlist_id}`} target="_blank" rel="noreferrer" className="small" style={{ fontWeight: 700 }}>
              Ouvrir dans Spotify ↗
            </a>
          ) : null}
        </div>
      </div>
      <BacDetail
        bac={{ id: bac.id, name: bac.name, brief: bac.brief, autoFill: bac.auto_fill }}
        tracks={tracks.map((t) => ({ ...t, label: t.source !== "ia" ? "rangé par toi" : t.isExample ? "exemple de l'IA" : "rangé par l'IA" }))}
        orderSlot={bac.spotify_playlist_id ? <PlayOrder bacId={bac.id} order={bac.play_order} /> : null}
      />
    </>
  );
}
