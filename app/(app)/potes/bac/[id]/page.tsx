import Link from "next/link";
import { notFound } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { poteBac } from "@/lib/potes";
import { Sleeve } from "../../../../ui/Sleeve";
import { RecoList } from "../../RecoList";

/** Un bac partagé par un pote : ses titres (ceux que j'ai déjà sont signalés), à suivre dans Spotify ou à piocher. */
export default async function PoteBacPage(props: PageProps<"/potes/bac/[id]">) {
  const member = await requireMember();
  const { id } = await props.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  let view;
  try {
    view = await poteBac(member.spotify_id, id);
  } catch (error) {
    // Un des deux a retiré son accord : retour à la page des potes, qui l'explique.
    console.warn("Bac d'un pote indisponible :", error instanceof Error ? error.message : error);
    view = null;
  }
  if (!view) notFound();
  const mine = view.tracks.filter((t) => t.mine).length;
  return (
    <>
      <Link href="/potes" className="back">
        ‹ Les potes
      </Link>
      <div className="row" style={{ gap: 16, alignItems: "flex-end" }}>
        <Sleeve name={view.bac.sleeve} color={view.bac.color} size={110} mark={view.bac.mark} />
        <div className="grow stack" style={{ gap: 6 }}>
          <span className="label">Chez {view.pote}</span>
          <h1 className="display display--s" style={{ fontSize: 24 }}>
            {view.bac.name}
          </h1>
          <span className="mono small">
            {view.bac.count} titres{mine > 0 ? ` · ${mine} déjà chez toi` : ""}
          </span>
          <a href={`https://open.spotify.com/playlist/${view.bac.playlistId}`} target="_blank" rel="noreferrer" className="small" style={{ fontWeight: 700 }}>
            Suivre dans Spotify ↗
          </a>
        </div>
      </div>
      <p style={{ margin: 0, fontSize: 14, lineHeight: 1.35 }}>{view.bac.pitch}</p>
      <RecoList tracks={view.tracks} />
    </>
  );
}
