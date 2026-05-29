#!/usr/bin/env tsx
/**
 * A/B benchmark : compare classifier v1 (L1/L2/L3) vs v2 (LLM-first) sur tous les tracks.
 *
 * Usage:
 *   npx tsx scripts/benchmark-ab.ts [--user <spotify_id>] [--out <path.xlsx>]
 *
 * Traite TOUS les tracks du user (classifiés ou non), lance les 2 classifiers en parallèle,
 * et écrit un fichier Excel avec 3 feuilles :
 *   - Comparaison   : toutes les lignes, v1 vs v2 côte à côte
 *   - Désaccords    : tracks où v1 et v2 divergent (playlist assignée différente)
 *   - Stats         : taux d'accord, confidence moyenne, inbox rate, par playlist
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import * as XLSX from "xlsx";

// ── Load .env.local ───────────────────────────────────────────────────────────
function loadEnv(filename = ".env.local"): void {
  try {
    const raw = readFileSync(join(process.cwd(), filename), "utf-8");
    for (const line of raw.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq === -1) continue;
      const key = t.slice(0, eq).trim();
      const val = t.slice(eq + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  } catch { /* vars already in env */ }
}
loadEnv();

import { classifyBatch } from "@/lib/classifier/engine";
import { classifyBatchV2 } from "@/lib/classifier/engine-v2";
import { getUserPlaylists } from "@/lib/supabase/queries";
import { createClient } from "@/lib/supabase/client";
import type { AudioFeatures, ClassifierTrack, PlaylistForClassifier } from "@/lib/types";
import type { Level3BatchInput } from "@/lib/classifier/level3-llm";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TrackRow {
  id: string;
  spotify_track_id: string;
  name: string | null;
  artists: string[] | null;
  album_name: string | null;
  spotify_added_at: string | null;
  genres: string[] | null;
  audio_features: AudioFeatures | null;
  assigned_playlist: string | null;
}

// ── CLI args ──────────────────────────────────────────────────────────────────

function parseArgs(): { user: string | null; out: string } {
  const argv = process.argv.slice(2);
  let user: string | null = null;
  let out = `benchmark-ab-${new Date().toISOString().slice(0, 10)}.xlsx`;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--user" && argv[i + 1]) { user = argv[++i]; }
    if (argv[i] === "--out" && argv[i + 1]) { out = argv[++i]; }
  }
  return { user, out };
}

// ── Fetch ALL tracks for a user ───────────────────────────────────────────────

async function fetchAllTracks(userId: string): Promise<TrackRow[]> {
  const supabase = createClient();
  const PAGE = 1000;
  const rows: TrackRow[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("tracks")
      .select("id, spotify_track_id, name, artists, album_name, spotify_added_at, genres, audio_features, assigned_playlist")
      .eq("user_id", userId)
      .eq("is_archived", false)
      .order("spotify_added_at", { ascending: false })
      .range(from, from + PAGE - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;
    rows.push(...(data as unknown as TrackRow[]));
    if (data.length < PAGE) break;
    from += PAGE;
  }

  return rows;
}

// ── Classify in chunks, v1 + v2 in parallel per chunk ────────────────────────

const CHUNK = 10;

async function runBoth(
  tracks: TrackRow[],
  playlists: PlaylistForClassifier[]
): Promise<{
  v1: Awaited<ReturnType<typeof classifyBatch>>;
  v2: Awaited<ReturnType<typeof classifyBatchV2>>;
}[]> {
  const allResults: { v1: Awaited<ReturnType<typeof classifyBatch>>; v2: Awaited<ReturnType<typeof classifyBatchV2>> }[] = [];
  const total = Math.ceil(tracks.length / CHUNK);

  for (let i = 0; i < tracks.length; i += CHUNK) {
    const chunk = tracks.slice(i, i + CHUNK);
    const chunkNum = Math.floor(i / CHUNK) + 1;
    process.stdout.write(`\r  Chunk ${chunkNum}/${total} (${i + chunk.length}/${tracks.length} tracks)...`);

    const inputs: Level3BatchInput[] = chunk.map((t) => ({
      track: {
        spotify_track_id: t.spotify_track_id,
        spotify_added_at: t.spotify_added_at,
        name: t.name ?? undefined,
        artists: t.artists ?? undefined,
        album_name: t.album_name ?? undefined,
      } satisfies ClassifierTrack,
      audioFeatures: t.audio_features,
      genres: t.genres ?? [],
    }));

    const [v1Results, v2Results] = await Promise.all([
      classifyBatch(inputs, playlists),
      classifyBatchV2(inputs, playlists),
    ]);

    for (let j = 0; j < chunk.length; j++) {
      allResults.push({ v1: [v1Results[j]], v2: [v2Results[j]] });
    }
  }

  process.stdout.write("\n");
  return allResults;
}

// ── Excel helpers ─────────────────────────────────────────────────────────────

type Row = Record<string, string | number | boolean | null>;

function af(track: TrackRow, key: keyof AudioFeatures): number | "" {
  const v = track.audio_features?.[key];
  return typeof v === "number" ? Math.round(v * 100) / 100 : "";
}

function tempo(track: TrackRow): number | "" {
  const v = track.audio_features?.tempo;
  return typeof v === "number" ? Math.round(v) : "";
}

function buildSheet(
  tracks: TrackRow[],
  results: { v1: Awaited<ReturnType<typeof classifyBatch>>; v2: Awaited<ReturnType<typeof classifyBatchV2>> }[],
  playlistMap: Map<string, string>,
  onlyDisagreements: boolean
): Row[] {
  const rows: Row[] = [];

  for (let i = 0; i < tracks.length; i++) {
    const t = tracks[i];
    const r1 = results[i].v1[0];
    const r2 = results[i].v2[0];

    const v1Name = r1.playlistId ? (playlistMap.get(r1.playlistId) ?? r1.playlistId) : (r1.llmSuggestion ? `⚡ ${playlistMap.get(r1.llmSuggestion) ?? r1.llmSuggestion}` : "inbox");
    const v2Name = r2.playlistId ? (playlistMap.get(r2.playlistId) ?? r2.playlistId) : (r2.llmSuggestion ? `⚡ ${playlistMap.get(r2.llmSuggestion) ?? r2.llmSuggestion}` : "inbox");
    const currentName = t.assigned_playlist ? (playlistMap.get(t.assigned_playlist) ?? t.assigned_playlist) : "non classifié";

    const agree = v1Name === v2Name;
    if (onlyDisagreements && agree) continue;

    rows.push({
      Artiste: t.artists?.[0] ?? "",
      Titre: t.name ?? t.spotify_track_id,
      Album: t.album_name ?? "",
      Genres: (t.genres ?? []).join(", "),
      Energy: af(t, "energy"),
      Dance: af(t, "danceability"),
      Valence: af(t, "valence"),
      Acoustic: af(t, "acousticness"),
      BPM: tempo(t),
      Playlist_actuelle: currentName,
      "v1 — playlist": v1Name,
      "v1 — confidence": Math.round(r1.confidence * 100) / 100,
      "v1 — level": `L${r1.level}`,
      "v1 — inbox?": r1.needsReview ? "oui" : "",
      "v1 — raison": r1.reason ?? "",
      "v2 — playlist": v2Name,
      "v2 — confidence": Math.round(r2.confidence * 100) / 100,
      "v2 — level": `L${r2.level}`,
      "v2 — inbox?": r2.needsReview ? "oui" : "",
      "v2 — raison": r2.reason ?? "",
      Accord: agree ? "oui" : "NON",
      "Δ confidence": Math.round((r2.confidence - r1.confidence) * 100) / 100,
    });
  }

  return rows;
}

function buildStats(
  tracks: TrackRow[],
  results: { v1: Awaited<ReturnType<typeof classifyBatch>>; v2: Awaited<ReturnType<typeof classifyBatchV2>> }[],
  playlistMap: Map<string, string>
): Row[] {
  let agrees = 0;
  let v1Inbox = 0;
  let v2Inbox = 0;
  let v1ConfSum = 0;
  let v2ConfSum = 0;
  const n = tracks.length;

  const byPlaylist = new Map<string, { v1: number; v2: number; agree: number }>();

  for (let i = 0; i < n; i++) {
    const r1 = results[i].v1[0];
    const r2 = results[i].v2[0];
    const v1Name = r1.playlistId ? (playlistMap.get(r1.playlistId) ?? r1.playlistId) : "inbox";
    const v2Name = r2.playlistId ? (playlistMap.get(r2.playlistId) ?? r2.playlistId) : "inbox";

    v1ConfSum += r1.confidence;
    v2ConfSum += r2.confidence;
    if (r1.needsReview) v1Inbox++;
    if (r2.needsReview) v2Inbox++;
    if (v1Name === v2Name) agrees++;

    // Per-playlist: count how many times each version assigns to it
    for (const [name, version] of [[v1Name, "v1"], [v2Name, "v2"]] as const) {
      if (!byPlaylist.has(name)) byPlaylist.set(name, { v1: 0, v2: 0, agree: 0 });
      if (version === "v1") byPlaylist.get(name)!.v1++;
      else byPlaylist.get(name)!.v2++;
    }
  }

  const rows: Row[] = [
    { Métrique: "Tracks total", v1: n, v2: n },
    { Métrique: "Accord v1/v2", v1: "", v2: `${agrees} (${Math.round(agrees / n * 100)}%)` },
    { Métrique: "Inbox rate", v1: `${v1Inbox} (${Math.round(v1Inbox / n * 100)}%)`, v2: `${v2Inbox} (${Math.round(v2Inbox / n * 100)}%)` },
    { Métrique: "Confidence moyenne", v1: Math.round(v1ConfSum / n * 100) / 100, v2: Math.round(v2ConfSum / n * 100) / 100 },
    { Métrique: "" },
    { Métrique: "Distribution par playlist", v1: "v1 — nb tracks", v2: "v2 — nb tracks" },
  ];

  for (const [name, counts] of [...byPlaylist.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    rows.push({ Métrique: name, v1: counts.v1, v2: counts.v2 });
  }

  return rows;
}

function addSheet(wb: XLSX.WorkBook, name: string, rows: Row[]): void {
  if (rows.length === 0) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["(aucune ligne)"]]), name);
    return;
  }
  const ws = XLSX.utils.json_to_sheet(rows);

  // Column widths
  const keys = Object.keys(rows[0]);
  ws["!cols"] = keys.map((k) => {
    if (k === "Titre" || k.includes("raison") || k === "Genres") return { wch: 35 };
    if (k === "Artiste" || k.includes("playlist")) return { wch: 22 };
    if (k === "Métrique") return { wch: 28 };
    return { wch: 12 };
  });

  XLSX.utils.book_append_sheet(wb, ws, name);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const { user: userArg, out } = parseArgs();
  const supabase = createClient();

  // Resolve user
  let userId: string;
  let spotifyId: string;

  if (userArg) {
    const { data, error } = await supabase
      .from("users").select("id, spotify_id").eq("spotify_id", userArg).single();
    if (error || !data) { console.error(`User "${userArg}" introuvable.`); process.exit(1); }
    userId = (data as { id: string; spotify_id: string }).id;
    spotifyId = (data as { id: string; spotify_id: string }).spotify_id;
  } else {
    const { data } = await supabase
      .from("users").select("id, spotify_id").eq("cron_enabled", true).limit(1).single();
    if (!data) { console.error("Aucun user éligible. Passe --user <spotify_id>."); process.exit(1); }
    userId = (data as { id: string; spotify_id: string }).id;
    spotifyId = (data as { id: string; spotify_id: string }).spotify_id;
  }

  console.log(`\nA/B benchmark — user: ${spotifyId}`);

  // Load playlists + all tracks
  console.log("Chargement des playlists et des tracks...");
  const [playlists, tracks] = await Promise.all([
    getUserPlaylists(userId),
    fetchAllTracks(userId),
  ]);

  if (playlists.length === 0) { console.error("Aucune playlist configurée."); process.exit(1); }
  if (tracks.length === 0) { console.error("Aucun track en base."); process.exit(1); }

  const playlistMap = new Map(playlists.map((p) => [p.id, p.name]));
  console.log(`${tracks.length} tracks — ${playlists.length} playlists\n`);

  // Run both classifiers
  console.log("Classification v1 + v2 en parallèle par batch...");
  const results = await runBoth(tracks, playlists);

  // Build Excel
  console.log("\nGénération du fichier Excel...");
  const wb = XLSX.utils.book_new();

  addSheet(wb, "Comparaison", buildSheet(tracks, results, playlistMap, false));
  addSheet(wb, "Désaccords", buildSheet(tracks, results, playlistMap, true));
  addSheet(wb, "Stats", buildStats(tracks, results, playlistMap));

  writeFileSync(out, XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
  console.log(`\nFichier écrit : ${out}`);

  // Quick summary in terminal
  let agrees = 0;
  let v1Inbox = 0;
  let v2Inbox = 0;
  for (const r of results) {
    const v1Name = r.v1[0].playlistId ?? "inbox";
    const v2Name = r.v2[0].playlistId ?? "inbox";
    if (v1Name === v2Name) agrees++;
    if (r.v1[0].needsReview) v1Inbox++;
    if (r.v2[0].needsReview) v2Inbox++;
  }
  const n = tracks.length;
  console.log(`\nRésumé :`);
  console.log(`  Tracks     : ${n}`);
  console.log(`  Accord     : ${agrees}/${n} (${Math.round(agrees / n * 100)}%)`);
  console.log(`  Inbox v1   : ${v1Inbox} (${Math.round(v1Inbox / n * 100)}%)`);
  console.log(`  Inbox v2   : ${v2Inbox} (${Math.round(v2Inbox / n * 100)}%)`);
  console.log(`  v1 conf moy: ${(results.reduce((s, r) => s + r.v1[0].confidence, 0) / n).toFixed(2)}`);
  console.log(`  v2 conf moy: ${(results.reduce((s, r) => s + r.v2[0].confidence, 0) / n).toFixed(2)}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
