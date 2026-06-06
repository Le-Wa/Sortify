import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getUserBySpotifyId, getAllPlaylists, getProfileTracks } from "@/lib/supabase/queries";
import { playlistSwatch } from "@/lib/playlist-swatch";
import ProfileClient from "./ProfileClient";
import type { DnaSegment, VibeCard, PatternData, EvoSeries, DiscoveryRow } from "./ProfileClient";

function hex2rgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "").padEnd(6, "0");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) redirect("/login");

  const dbUser = await getUserBySpotifyId(session.userId);
  if (!dbUser) redirect("/login");

  const [playlists, tracks] = await Promise.all([
    getAllPlaylists(dbUser.id),
    getProfileTracks(dbUser.id),
  ]);

  const firstName = session.user?.name?.split(" ")[0] ?? "Toi";
  const userImage = session.user?.image ?? null;

  // ── DNA: track count per playlist ───────────────────────────────────────────
  const tracksByPlId = new Map<string, number>();
  for (const t of tracks) {
    if (!t.assigned_playlist) continue;
    tracksByPlId.set(t.assigned_playlist, (tracksByPlId.get(t.assigned_playlist) ?? 0) + 1);
  }
  const totalTracks = tracks.length;

  const dnaSegments: DnaSegment[] = playlists
    .map(pl => {
      const count = tracksByPlId.get(pl.id) ?? 0;
      return { id: pl.id, label: pl.name, count, pct: Math.round((count / Math.max(totalTracks, 1)) * 100), color: playlistSwatch(pl.id, pl.color) };
    })
    .filter(s => s.count > 0)
    .sort((a, b) => b.count - a.count);

  const activePlaylists = playlists.filter(p => (tracksByPlId.get(p.id) ?? 0) > 0);

  // ── Vibes: top 4 playlists ───────────────────────────────────────────────────
  const vibes: VibeCard[] = dnaSegments.slice(0, 4).map(seg => {
    const plTracks = tracks.filter(t => t.assigned_playlist === seg.id);

    const genreCount = new Map<string, number>();
    for (const t of plTracks) {
      for (const g of (t.genres ?? [])) genreCount.set(g, (genreCount.get(g) ?? 0) + 1);
    }
    const topGenres = [...genreCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(e => e[0]);

    const artistCount = new Map<string, number>();
    for (const t of plTracks) {
      for (const a of (t.artists ?? [])) artistCount.set(a, (artistCount.get(a) ?? 0) + 1);
    }
    const topArtists = [...artistCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(e => e[0]);

    const [r, g, b] = hex2rgb(seg.color);
    return {
      name: seg.label,
      trackCount: seg.count,
      desc: topGenres.length ? topGenres.join(" · ") : "—",
      color: seg.color,
      bg: `rgba(${r},${g},${b},.15)`,
      artists: topArtists,
    };
  });

  // ── Heatmap: day (0=Mon) × slot (0=Matin 1=Aprèm 2=Soir 3=Nuit) ─────────────
  const heatRaw = Array.from({ length: 7 }, () => [0, 0, 0, 0]);
  for (const t of tracks) {
    if (!t.spotify_added_at) continue;
    const d = new Date(t.spotify_added_at);
    const dow = (d.getDay() + 6) % 7;
    const h = d.getHours();
    const slot = h < 12 ? 0 : h < 18 ? 1 : h < 22 ? 2 : 3;
    heatRaw[dow][slot]++;
  }
  const maxHeat = Math.max(...heatRaw.flat(), 1);
  const heat = heatRaw.map(row => row.map(v => Math.min(3, Math.floor((v / maxHeat) * 4))));

  // ── Patterns ─────────────────────────────────────────────────────────────────
  const slotTotals = [0, 0, 0, 0];
  for (const row of heatRaw) row.forEach((v, i) => { slotTotals[i] += v; });
  const peakSlot = slotTotals.indexOf(Math.max(...slotTotals));
  const SLOT_LABELS = ["le matin", "l'après-midi", "le soir", "la nuit"];
  const peakPct = totalTracks > 0 ? Math.round((slotTotals[peakSlot] / totalTracks) * 100) : 0;

  const dayTotals = heatRaw.map(row => row.reduce((s, v) => s + v, 0));
  const peakDay = dayTotals.indexOf(Math.max(...dayTotals));
  const DAY_NAMES = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
  const avgPerDay = totalTracks / 7;
  const bingeRatio = avgPerDay > 0 ? (dayTotals[peakDay] / avgPerDay) : 1;

  const now = Date.now();
  const ages = tracks
    .filter(t => t.spotify_added_at)
    .map(t => (now - new Date(t.spotify_added_at!).getTime()) / (1000 * 60 * 60 * 24 * 365));
  const avgAge = ages.length > 0 ? ages.reduce((s, v) => s + v, 0) / ages.length : 0;

  const patterns: PatternData[] = [
    {
      icon: peakSlot === 3 ? "🌙" : peakSlot === 2 ? "🌆" : "☀️",
      title: `Écoute ${SLOT_LABELS[peakSlot]}`,
      sub: `${peakPct}% de tes ajouts ${SLOT_LABELS[peakSlot]}`,
      val: `${peakPct}%`,
    },
    {
      icon: "📅",
      title: "Binge hebdo",
      sub: `Plus actif le ${DAY_NAMES[peakDay]}`,
      val: `×${bingeRatio.toFixed(1)}`,
    },
    {
      icon: "🎵",
      title: "Collection",
      sub: `${totalTracks} titres dans ${activePlaylists.length} playlist${activePlaylists.length !== 1 ? "s" : ""}`,
      val: `${totalTracks}`,
    },
    {
      icon: "🕰️",
      title: "Âge moyen",
      sub: avgAge < 1 ? "Tu penches très récent" : "Tu gardes des classiques",
      val: avgAge < 0.1 ? "< 1 an" : `${avgAge.toFixed(1)} ans`,
    },
  ];

  // ── Taste evolution: top 3 playlists over last 6 months ─────────────────────
  const SIX_MONTHS_AGO = new Date(now - 6 * 30 * 24 * 60 * 60 * 1000);
  const monthlyByPl = new Map<string, Map<string, number>>();

  for (const t of tracks) {
    if (!t.spotify_added_at || !t.assigned_playlist) continue;
    const d = new Date(t.spotify_added_at);
    if (d < SIX_MONTHS_AGO) continue;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!monthlyByPl.has(key)) monthlyByPl.set(key, new Map());
    const m = monthlyByPl.get(key)!;
    m.set(t.assigned_playlist, (m.get(t.assigned_playlist) ?? 0) + 1);
  }

  const sortedMonths = [...monthlyByPl.keys()].sort();
  const top3PlIds = dnaSegments.slice(0, 3).map(s => s.id);

  const evoSeries: EvoSeries[] = top3PlIds.map(plId => {
    const pl = playlists.find(p => p.id === plId)!;
    const vals = sortedMonths.map(month => {
      const m = monthlyByPl.get(month);
      if (!m) return 0;
      const total = [...m.values()].reduce((s, v) => s + v, 0);
      return total > 0 ? Math.round(((m.get(plId) ?? 0) / total) * 100) : 0;
    });
    return { name: pl.name, color: playlistSwatch(plId, pl.color), vals };
  });

  const MONTH_LABELS = ["", "Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
  const evoLabels = sortedMonths.map(m => MONTH_LABELS[parseInt(m.split("-")[1])]);

  // ── Discoveries: 5 most recently classified ──────────────────────────────────
  const discoveries: DiscoveryRow[] = tracks
    .filter(t => t.name && t.artists?.length && t.assigned_playlist)
    .slice(0, 5)
    .map(t => {
      const pl = playlists.find(p => p.id === t.assigned_playlist);
      const color = pl ? playlistSwatch(pl.id, pl.color) : "#888888";
      const [r, g, b] = hex2rgb(color);
      return {
        title: t.name!,
        artist: t.artists![0],
        plName: pl?.name ?? "—",
        plColor: color,
        plBg: `rgba(${r},${g},${b},.18)`,
        init: t.name!.slice(0, 2).toUpperCase(),
      };
    });

  return (
    <ProfileClient
      firstName={firstName}
      userImage={userImage}
      totalTracks={totalTracks}
      playlistCount={activePlaylists.length}
      dnaSegments={dnaSegments}
      vibes={vibes}
      heat={heat}
      patterns={patterns}
      evoSeries={evoSeries}
      evoLabels={evoLabels}
      discoveries={discoveries}
    />
  );
}
