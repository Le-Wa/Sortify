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
import DashboardInboxPreview from "./DashboardInboxPreview";

const MS_30D = 30 * 24 * 60 * 60 * 1000;

const COHERENCE_DIMS = [
  "energy",
  "danceability",
  "valence",
  "acousticness",
  "instrumentalness",
] as const;
const MAX_DIST = Math.sqrt(COHERENCE_DIMS.length);

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

function scoreBadgeStyle(score: number): React.CSSProperties {
  if (score > 80) return { background: "var(--sage-light)", color: "var(--sage)", border: "1px solid var(--sage-border)" };
  if (score >= 60) return { background: "var(--amber-light)", color: "var(--amber)", border: "1px solid rgba(200,152,64,0.2)" };
  return { background: "var(--terra-light)", color: "var(--terra)", border: "1px solid var(--terra-border)" };
}

function moodLabel(valence100: number): string {
  if (valence100 < 30) return "Mélancolique";
  if (valence100 <= 65) return "Neutre";
  return "Positif";
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Bonne nuit";
  if (h < 12) return "Bonjour";
  if (h < 18) return "Bonne après-midi";
  return "Bonsoir";
}

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

  const firstName = session.user?.name?.split(" ")[0] ?? "toi";

  return (
    <main className="s-page">
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 15, fontWeight: 400, color: "var(--ink-mid)", marginBottom: 6 }}>
          {greeting()}, <span style={{ color: "var(--ink)" }}>{firstName}</span>
        </div>
        <h1
          className="font-fraunces s-page-h1"
          style={{ fontSize: 36, fontWeight: 600, letterSpacing: "-0.5px", color: "var(--ink)", lineHeight: 1.1 }}
        >
          Tout va{" "}
          <em style={{ fontStyle: "italic", color: "var(--terra)" }}>bien</em>{" "}
          tourner.
        </h1>
      </div>

      {/* Stats + actions */}
      <DashboardActions />

      {/* Inbox preview */}
      <DashboardInboxPreview />

      {/* Playlists grid */}
      {playlists.length > 0 && (
        <section style={{ marginTop: 32 }}>
          <div className="s-section-title">Playlists</div>
          <div className="s-pl-grid">
            {playlists.map((pl, i) => {
              const swatchColors = ["#c89840", "#8878d0", "#6a9070", "#c87a52", "#a06848", "#508860"];
              const swatch = swatchColors[i % swatchColors.length];
              const plHealth = health.find((h) => h.id === pl.id);
              return (
                <Link
                  key={pl.id}
                  href={`/playlists/${pl.id}`}
                  className="s-pl-card"
                  style={{ textDecoration: "none", display: "block" }}
                >
                  <div
                    style={{
                      height: 3,
                      borderRadius: 2,
                      background: swatch,
                      marginBottom: 14,
                      opacity: 0.85,
                    }}
                  />
                  <div
                    className="font-fraunces"
                    style={{
                      fontSize: 16,
                      fontWeight: 600,
                      color: "var(--ink)",
                      marginBottom: 6,
                      lineHeight: 1.2,
                    }}
                  >
                    {pl.name}
                  </div>
                  {pl.description && (
                    <div
                      style={{
                        fontSize: 11,
                        color: "var(--ink-dim)",
                        marginBottom: 10,
                        lineHeight: 1.4,
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {pl.description}
                    </div>
                  )}
                  <div
                    className="font-fraunces"
                    style={{ fontSize: 22, fontWeight: 600, color: swatch, lineHeight: 1 }}
                  >
                    {plHealth?.trackCount ?? 0}
                    <span
                      style={{
                        fontFamily: "var(--font-geist-sans)",
                        fontSize: 11,
                        fontWeight: 400,
                        color: "var(--ink-dim)",
                        marginLeft: 5,
                      }}
                    >
                      titres
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Playlist health */}
      <section style={{ marginTop: 32 }}>
        <div className="s-section-title">Santé des playlists</div>
        {health.length === 0 ? (
          <p style={{ color: "var(--ink-mid)", fontSize: 13 }}>Aucune playlist configurée</p>
        ) : (
          <div className="s-table-wrap"><table className="s-table" style={{ width: "100%" }}>
            <thead>
              <tr>
                <th>Playlist</th>
                <th style={{ textAlign: "right" }}>Tracks</th>
                <th style={{ textAlign: "right" }}>Cohérence</th>
              </tr>
            </thead>
            <tbody>
              {health.map((pl) => (
                <tr key={pl.id}>
                  <td>
                    <Link
                      href={`/playlists/${pl.id}`}
                      style={{ color: "var(--ink)", textDecoration: "none" }}
                    >
                      {pl.name}
                    </Link>
                  </td>
                  <td style={{ textAlign: "right", color: "var(--ink-mid)" }}>
                    {pl.trackCount}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    {pl.score !== null ? (
                      <span
                        style={{
                          display: "inline-block",
                          borderRadius: 20,
                          padding: "2px 10px",
                          fontSize: 11,
                          fontWeight: 500,
                          ...scoreBadgeStyle(pl.score),
                        }}
                      >
                        {pl.score}
                      </span>
                    ) : (
                      <span style={{ color: "var(--ink-dimmer)", fontSize: 11 }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </section>

      {/* Emotional profile */}
      {valence100 !== null && (
        <section style={{ marginTop: 32 }}>
          <div className="s-section-title">Profil émotionnel · 30 jours</div>
          <div
            className="s-card"
            style={{ padding: "20px 22px" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
              <span style={{ fontSize: 16, fontWeight: 500, color: "var(--ink)" }}>
                {moodLabel(valence100)}
              </span>
              <span style={{ fontSize: 13, color: "var(--ink-mid)" }}>{valence100} / 100</span>
            </div>
            <div style={{ height: 4, borderRadius: 4, background: "var(--surface3)", overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  borderRadius: 4,
                  background: `linear-gradient(to right, var(--terra), var(--amber), var(--sage))`,
                  width: `${valence100}%`,
                  transition: "width 0.3s",
                }}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 10, color: "var(--ink-dim)" }}>
              <span>Mélancolique</span>
              <span>Neutre</span>
              <span>Positif</span>
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
