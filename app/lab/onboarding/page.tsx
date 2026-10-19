import { notFound } from "next/navigation";
import { Suspense } from "react";
import { listBacs } from "@/lib/bacs";
import { markFor } from "@/lib/cover-shapes";
import { check, db } from "@/lib/db";
import { powerRedirectUri } from "@/lib/power-login";
import { Demo, type DemoData } from "./Demo";

/** Titres de la fausse bibliothèque (les plus récents du propriétaire). */
const TRACKS = 240;

/**
 * Démo de l'onboarding (développement seulement) : les vrais écrans, de la connexion à la création des bacs,
 * rejoués sans Spotify ni IA. Les titres et les bacs viennent de la bibliothèque du propriétaire, en lecture seule.
 */
export default async function OnboardingDemoPage() {
  if (process.env.NODE_ENV === "production") notFound();
  const owner = check(await db().from("members").select("spotify_id").eq("is_owner", true).single(), "Propriétaire") as { spotify_id: string };
  const likes = check(
    await db()
      .from("likes")
      .select("track_id, title, artists, cover_url, isrc, liked_at")
      .eq("member_id", owner.spotify_id)
      .is("unliked_at", null)
      .order("liked_at", { ascending: false })
      .limit(TRACKS),
    "Likes de la démo",
  ) as { track_id: string; title: string; artists: string[]; cover_url: string | null; isrc: string | null; liked_at: string }[];
  const bacs = (await listBacs(owner.spotify_id, ["active"])).filter((b) => !b.is_divers).slice(0, 9);
  const placed = check(
    await db()
      .from("placements")
      .select("bac_id, track_id")
      .in(
        "bac_id",
        bacs.map((b) => b.id),
      )
      .in(
        "track_id",
        likes.map((l) => l.track_id),
      ),
    "Rangements de la démo",
  ) as { bac_id: string; track_id: string }[];
  const index = new Map(likes.map((l, i) => [l.track_id, i]));
  const data: DemoData = {
    redirectUri: powerRedirectUri(),
    tracks: likes.map((l) => ({ track_id: l.track_id, title: l.title, artist: l.artists[0] ?? "", cover_url: l.cover_url, isrc: l.isrc, liked_at: l.liked_at })),
    bacs: bacs.map((b) => ({
      id: b.id,
      name: b.name,
      sleeve: b.sleeve_name ?? b.name,
      color: b.color,
      mark: markFor(b),
      pitch: b.pitch,
      axis: b.axis,
      tracks: placed.filter((p) => p.bac_id === b.id).map((p) => index.get(p.track_id)!),
    })),
  };
  return (
    <Suspense>
      <Demo data={data} />
    </Suspense>
  );
}
