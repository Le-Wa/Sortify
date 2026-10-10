import { redirect } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { examplesFor, listBacs, placementCounts } from "@/lib/bacs";
import { latestJob } from "@/lib/jobs";
import type { ImportProgress } from "@/lib/import";
import { revelationState } from "@/lib/revelation";
import { CreationScreen } from "./CreationScreen";
import { ProposalScreen, type ProposalBac } from "./ProposalScreen";
import { WaitScreen } from "./WaitScreen";

/** Première visite : import, analyse, proposition des bacs, puis création dans Spotify. */
export default async function RevelationPage() {
  const member = await requireMember();
  const state = await revelationState(member.spotify_id);
  if (state.stage === "done") redirect("/accueil");

  if (state.stage === "import" || state.stage === "analyse") {
    return (
      <main className="page page--bare">
        <WaitScreen stage={state.stage} />
      </main>
    );
  }

  if (state.stage === "creation") {
    return (
      <main className="page page--bare">
        <CreationScreen />
      </main>
    );
  }

  const [bacs, imp] = await Promise.all([
    listBacs(member.spotify_id, ["proposed", "removed"]),
    latestJob<ImportProgress>(member.spotify_id, "import"),
  ]);
  const [counts, examples] = await Promise.all([placementCounts(bacs.map((b) => b.id)), examplesFor(bacs.map((b) => b.id))]);
  const proposal: ProposalBac[] = bacs.map((b) => ({
    id: b.id,
    name: b.name,
    sleeve: b.sleeve_name ?? b.name,
    pitch: b.pitch,
    axis: b.axis,
    color: b.color,
    kept: b.status === "proposed",
    count: counts.get(b.id) ?? 0,
    filling: b.needs_fill,
    examples: (examples.get(b.id)?.positive ?? []).map((e) => ({
      track_id: e.track_id,
      title: e.title,
      artist: e.artist,
      cover_url: e.cover_url,
      isrc: e.isrc,
    })),
  }));

  return (
    <main className="page page--bare">
      <ProposalScreen
        likes={imp?.progress.imported ?? 0}
        period={imp?.progress.mode === "tout" ? "tout l'historique" : "2 ans"}
        bacs={proposal}
        filling={state.filling}
        error={state.error}
      />
    </main>
  );
}
