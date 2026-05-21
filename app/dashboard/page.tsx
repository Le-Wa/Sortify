import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import {
  getUserBySpotifyId,
  getUserPlaylists,
  getDashboardTracks,
  type DashboardTrackRow,
} from "@/lib/supabase/queries";
import type { PlaylistCentroid } from "@/lib/types";
import Link from "next/link";
import DashboardActions from "./DashboardActions";

// ── Constants ────────────────────────────────────────────────────────────────

const MS_30D = 30 * 24 * 60 * 60 * 1000;

const COHERENCE_DIMS = [
  "energy",
  "danceability",
  "valence",
  "acousticness",
  "instrumentalness",
] as const;
const MAX_DIST = Math.sqrt(COHERENCE_DIMS.length); // √5 ≈ 2.236

// ── Pure helpers ─────────────────────────────────────────────────────────────

function coherenceScore(
  features: (Record<string, number> | null)[],
  centroid: PlaylistCentroid
): number {
  const valid = features.filter((f): f is Record<string, number> => f !== null);
  if (valid.length === 0) return 100;

  const avgDist =
    valid.reduce((sum, f) => {
      let sq = 0;
      for (const dim of COHERENCE_DIMS) sq += ((f[dim] ?? 0) - centroid[dim]) ** 2;
      return sum + Math.sqrt(sq);
    }, 0) / valid.length;

  return Math.max(0, Math.round((1 - avgDist / MAX_DIST) * 100));
}

function badgeStyle(score: number): string {
  if (score > 80) return "bg-emerald-600 text-white";
  if (score >= 60) return "bg-amber-500 text-white";
  return "bg-red-600 text-white";
}

function moodLabel(valence100: number): string {
  if (valence100 < 30) return "Mélancolique";
  if (valence100 <= 65) return "Neutre";
  return "Positif";
}

// ── Sub-components (server, no "use client") ─────────────────────────────────

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 px-4 py-5 text-center">
      <p className="text-3xl font-bold">{value}</p>
      <p className="mt-1 text-xs text-neutral-400">{label}</p>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) redirect("/login");

  const dbUser = await getUserBySpotifyId(session.userId);
  if (!dbUser) redirect("/login");

  const [playlists, tracks] = await Promise.all([
    getUserPlaylists(dbUser.id),
    getDashboardTracks(dbUser.id),
  ]);

  const now = Date.now();

  // ── Inbox count ─────────────────────────────────────────────────────────
  const inboxCount = tracks.filter((t) => !t.is_archived && t.needs_review).length;

  // ── Global stats ─────────────────────────────────────────────────────────
  const total = tracks.filter((t) => !t.is_archived).length;
  const classified = tracks.filter((t) => !t.is_archived && t.assigned_playlist !== null).length;
  const coverage = total > 0 ? Math.round((classified / total) * 100) : 0;

  // ── Emotional profile (last 30 days classified) ───────────────────────────
  const recent = tracks.filter(
    (t): t is DashboardTrackRow & { audio_features: Record<string, number> } =>
      t.classified_at !== null &&
      t.audio_features !== null &&
      new Date(t.spotify_added_at ?? 0).getTime() > now - MS_30D
  );
  const avgValence =
    recent.length > 0
      ? recent.reduce((s, t) => s + (t.audio_features.valence ?? 0), 0) / recent.length
      : null;
  const valence100 = avgValence !== null ? Math.round(avgValence * 100) : null;

  // ── Playlist health ───────────────────────────────────────────────────────
  const featuresByPlaylist = new Map<string, (Record<string, number> | null)[]>();
  for (const t of tracks) {
    if (!t.assigned_playlist) continue;
    const arr = featuresByPlaylist.get(t.assigned_playlist) ?? [];
    arr.push(t.audio_features as Record<string, number> | null);
    featuresByPlaylist.set(t.assigned_playlist, arr);
  }

  const health = playlists.map((pl) => {
    const features = featuresByPlaylist.get(pl.id) ?? [];
    return {
      id: pl.id,
      name: pl.name,
      trackCount: features.length,
      score: pl.centroid ? coherenceScore(features, pl.centroid) : null,
    };
  });

  // ────────────────────────────────────────────────────────────────────────

  return (
    <main className="mx-auto max-w-3xl space-y-8 px-4 py-10 text-white">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* ── 0. Stats + Actions (client island) ──────────────────────────── */}
      <DashboardActions />

      {/* ── 1. Playlist Health ───────────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-neutral-500">
          Playlist Health
        </h2>
        <div className="overflow-hidden rounded-xl border border-neutral-800">
          {health.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-neutral-500">
              Aucune playlist configurée
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-neutral-800 text-left text-neutral-500">
                <tr>
                  <th className="px-5 py-2.5 font-medium">Playlist</th>
                  <th className="px-5 py-2.5 text-right font-medium">Tracks</th>
                  <th className="px-5 py-2.5 text-right font-medium">Cohérence</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {health.map((pl) => (
                  <tr key={pl.id} className="bg-neutral-900">
                    <td className="px-5 py-3 font-medium">{pl.name}</td>
                    <td className="px-5 py-3 text-right tabular-nums text-neutral-300">
                      {pl.trackCount}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {pl.score !== null ? (
                        <span
                          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${badgeStyle(pl.score)}`}
                        >
                          {pl.score}
                        </span>
                      ) : (
                        <span className="text-xs text-neutral-700">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {/* ── 2. Inbox ─────────────────────────────────────────────────────── */}
      <section className="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900 px-5 py-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-neutral-500">
            En attente de review
          </p>
          <p className="mt-1 text-4xl font-bold tabular-nums">{inboxCount}</p>
        </div>
          <Link
          href="/inbox"
          className="rounded-lg bg-neutral-700 px-4 py-2 text-sm font-medium transition-colors hover:bg-neutral-600"
        >
          Voir l'inbox →
        </Link>
      </section>

      {/* ── 3. Profil émotionnel ─────────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-neutral-500">
          Profil émotionnel · 30 derniers jours
        </h2>
        <div className="rounded-xl border border-neutral-800 bg-neutral-900 px-5 py-5">
          {valence100 !== null ? (
            <>
              <div className="mb-3 flex items-baseline justify-between">
                <span className="text-lg font-semibold">{moodLabel(valence100)}</span>
                <span className="text-sm tabular-nums text-neutral-400">
                  {valence100}&thinsp;/&thinsp;100
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-neutral-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-600 via-purple-500 to-amber-400 transition-all"
                  style={{ width: `${valence100}%` }}
                />
              </div>
              <div className="mt-2 flex justify-between text-xs text-neutral-600">
                <span>Mélancolique</span>
                <span>Neutre</span>
                <span>Positif</span>
              </div>
            </>
          ) : (
            <p className="text-sm text-neutral-500">
              Pas assez de données — lance le tri pour voir ton profil.
            </p>
          )}
        </div>
      </section>

      {/* ── 4. Stats globales ────────────────────────────────────────────── */}
      <section>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-widest text-neutral-500">
          Stats globales
        </h2>
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="En base" value={total} />
          <StatCard label="Classifiés" value={classified} />
          <StatCard label="Couverture" value={`${coverage} %`} />
        </div>
      </section>
    </main>
  );
}
