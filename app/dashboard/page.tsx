import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import {
  getUserBySpotifyId,
  getUserPlaylists,
  getDashboardTracks,
  getDashboardCounts,
  type DashboardTrackRow,
} from "@/lib/supabase/queries";
import Link from "next/link";
import DashboardActions from "./DashboardActions";
import DashboardInboxPreview from "./DashboardInboxPreview";
import { playlistSwatch } from "@/lib/playlist-swatch";

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

const MS_30D = 30 * 24 * 60 * 60 * 1000;

function nextMonday(): string {
  const d = new Date();
  const day = d.getDay();
  const daysUntilMonday = ((8 - day) % 7) || 7;
  d.setDate(d.getDate() + daysUntilMonday);
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Bonne nuit";
  if (h < 12) return "Bonjour";
  if (h < 18) return "Bonne après-midi";
  return "Bonsoir";
}

function moodPhrase(valence100: number): string {
  if (valence100 < 30) return "Tes 30 derniers jours penchent vers la mélancolie.";
  if (valence100 <= 65) return "Ton mood est resté équilibré ces 30 derniers jours.";
  return "Tes 30 derniers jours étaient lumineux.";
}

function moodLabel(valence100: number): string {
  if (valence100 < 30) return "Mélancolique";
  if (valence100 <= 65) return "Neutre";
  return "Positif";
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) redirect("/login");

  const dbUser = await getUserBySpotifyId(session.userId);
  if (!dbUser) redirect("/login");

  const [playlists, tracks, counts] = await Promise.all([
    getUserPlaylists(dbUser.id),
    getDashboardTracks(dbUser.id),
    getDashboardCounts(dbUser.id),
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

  const trackCountByPlaylist = new Map<string, number>();
  for (const t of tracks) {
    if (!t.assigned_playlist) continue;
    trackCountByPlaylist.set(t.assigned_playlist, (trackCountByPlaylist.get(t.assigned_playlist) ?? 0) + 1);
  }

  const firstName = session.user?.name?.split(" ")[0] ?? "toi";

  const needsReview = counts.needs_review;
  const isNew = counts.imported === 0;

  return (
    <main className="s-page">
      {/* Header narratif */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 13, fontWeight: 400, color: "var(--ink-dim)", marginBottom: 8, letterSpacing: "0.02em" }}>
          {greeting()},{" "}
          <span style={{ color: "var(--terra)", fontWeight: 500 }}>{firstName}</span>
        </div>

        <h1
          className="font-fraunces s-page-h1"
          style={{ fontSize: 38, fontWeight: 700, letterSpacing: "-0.6px", color: "var(--ink)", lineHeight: 1.15, marginBottom: 12 }}
        >
          {isNew ? (
            <>Bienvenue. Lie ta{" "}
              <em style={{ fontStyle: "italic", color: "var(--terra)" }}>première</em>{" "}
              playlist.
            </>
          ) : needsReview > 0 ? (
            <>Tu as{" "}
              <span style={{ color: "var(--terra)" }}>{needsReview}</span>{" "}
              titre{needsReview > 1 ? "s" : ""} qui t'attend{needsReview > 1 ? "ent" : ""}.
            </>
          ) : (
            <>Tout est{" "}
              <em style={{ fontStyle: "italic", color: "var(--sage)" }}>trié</em>.{" "}
              Profite.
            </>
          )}
        </h1>

        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <p style={{ fontSize: 12, color: "var(--ink-dim)", margin: 0 }}>
            Prochain tri auto · {nextMonday()} · 08h00
          </p>
          {needsReview > 0 && (
            <Link
              href="/inbox"
              className="s-btn s-btn-primary"
              style={{ textDecoration: "none", fontSize: 13 }}
            >
              Trier →
            </Link>
          )}
        </div>
      </div>

      {/* Stats + actions */}
      <DashboardActions
        initialCounts={{
          needs_review: counts.needs_review,
          imported: counts.imported,
          in_playlists: counts.in_playlists,
          last_sync_at: counts.last_sync_at,
        }}
      />

      {/* Inbox preview */}
      <DashboardInboxPreview />

      {/* Playlists grid */}
      {playlists.length > 0 && (
        <section style={{ marginTop: 32 }}>
          <div className="s-section-title">Playlists</div>
          <div className="s-pl-grid">
            {playlists.map((pl) => {
              const swatch = playlistSwatch(pl.id);
              const trackCount = trackCountByPlaylist.get(pl.id) ?? 0;
              return (
                <Link
                  key={pl.id}
                  href={`/playlists/${pl.id}`}
                  className="s-pl-card"
                  style={{
                    textDecoration: "none", display: "block",
                    background: hexToRgba(swatch, 0.10),
                    borderColor: `${swatch}44`,
                  }}
                >
                  <div
                    className="font-fraunces"
                    style={{ fontSize: 16, fontWeight: 600, color: "var(--ink)", marginBottom: 6, lineHeight: 1.2 }}
                  >
                    {pl.name}
                  </div>
                  {pl.description && (
                    <div style={{
                      fontSize: 11, color: "var(--ink-dim)", marginBottom: 10, lineHeight: 1.4,
                      display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                    }}>
                      {pl.description}
                    </div>
                  )}
                  <div className="font-fraunces" style={{ fontSize: 22, fontWeight: 600, color: swatch, lineHeight: 1 }}>
                    {trackCount}
                    <span style={{ fontFamily: "var(--font-geist-sans)", fontSize: 11, fontWeight: 400, color: "var(--ink-dim)", marginLeft: 5 }}>
                      titres
                    </span>
                  </div>
                  <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, background: swatch }} />
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Emotional profile */}
      {valence100 !== null && (
        <section style={{ marginTop: 32 }}>
          <div className="s-section-title">Profil émotionnel · 30 jours</div>
          <div className="s-card" style={{ padding: "20px 22px" }}>
            <p style={{ fontSize: 13, color: "var(--ink-mid)", marginBottom: 14, margin: "0 0 14px" }}>
              {moodPhrase(valence100)}
            </p>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 500, color: "var(--ink)" }}>{moodLabel(valence100)}</span>
              <span style={{ fontSize: 12, color: "var(--ink-mid)" }}>{valence100} / 100</span>
            </div>
            <div style={{ height: 4, borderRadius: 4, background: "var(--surface3)", overflow: "hidden" }}>
              <div style={{
                height: "100%", borderRadius: 4,
                background: `linear-gradient(to right, var(--terra), var(--amber), var(--sage))`,
                width: `${valence100}%`, transition: "width 0.3s",
              }} />
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
