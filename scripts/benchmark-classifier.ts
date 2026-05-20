#!/usr/bin/env node
/**
 * Benchmark the 3-level classifier against a stratified sample of classified tracks.
 *
 * Usage:
 *   npx tsx scripts/benchmark-classifier.ts [--user <spotify_user_id>]
 *
 * First run: auto-selects 30 tracks from DB, shows what the classifier assigns.
 * After first run: fill in EXPECTED_PLAYLISTS below to measure accuracy.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

function loadEnvFile(filename = ".env.local"): void {
  try {
    const raw = readFileSync(join(process.cwd(), filename), "utf-8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    // No .env.local → assume vars are set in the environment
  }
}

loadEnvFile();

import { classify } from "@/lib/classifier/engine";
import { getUserPlaylists } from "@/lib/supabase/queries";
import { createClient } from "@/lib/supabase/client";
import type { AudioFeatures, ClassifierTrack, PlaylistForClassifier } from "@/lib/types";

// ── Manual expectations — fill these in after first run ──────────────────────
// Key = spotify_track_id, value = expected playlist name (exact match)
const EXPECTED_PLAYLISTS: Record<string, string> = {
  // "4uLU6hMCjMI75M1A2tKUQC": "Good Electro",
  // "3n3Ppam7vgaVa1iaRUIOKE": "Good Techno",
};

// ── Types ────────────────────────────────────────────────────────────────────

interface TrackRow {
  spotify_track_id: string;
  name: string | null;
  artists: string[] | null;
  isrc: string | null;
  spotify_added_at: string | null;
  audio_features: AudioFeatures | null;
  genres: string[] | null;
  assigned_playlist: string | null;
}

interface BenchmarkResult {
  track_id: string;
  name: string;
  artist: string;
  expected: string | null;
  suggested: string | null;
  confidence: number;
  needs_review: boolean;
  level: number;
  verdict: "correct" | "wrong" | "needs_review" | "unverified";
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--with-llm") { out["with-llm"] = true; continue; }
    if (argv[i].startsWith("--") && i + 1 < argv.length) {
      out[argv[i].slice(2)] = argv[i + 1];
      i++;
    }
  }
  return out;
}

function pct(n: number, total: number): string {
  return total === 0 ? "0%" : `${Math.round((n / total) * 100)}%`;
}

function bar(ok: boolean | null): string {
  if (ok === null) return "⬜";
  return ok ? "✅" : "❌";
}

// ── Sample tracks from DB ────────────────────────────────────────────────────

async function sampleTracks(userId: string, playlists: PlaylistForClassifier[]): Promise<TrackRow[]> {
  const supabase = createClient();
  const TRACKS_PER_PLAYLIST = 5;
  const AMBIGUOUS_QUOTA = 5;

  // 5 tracks per playlist (already assigned — audio_features may be null)
  const perPlaylistRows: TrackRow[] = [];
  for (const playlist of playlists) {
    const { data } = await supabase
      .from("tracks")
      .select("spotify_track_id, name, artists, isrc, spotify_added_at, audio_features, genres, assigned_playlist")
      .eq("user_id", userId)
      .eq("assigned_playlist", playlist.id)
      .limit(TRACKS_PER_PLAYLIST * 3) // fetch extra, then shuffle
      .order("classified_at", { ascending: false });

    if (!data) continue;
    const shuffled = data.sort(() => Math.random() - 0.5).slice(0, TRACKS_PER_PLAYLIST);
    perPlaylistRows.push(...(shuffled as unknown as TrackRow[]));
  }

  // Ambiguous: needs_review = true
  const { data: ambiguous } = await supabase
    .from("tracks")
    .select("spotify_track_id, name, artists, isrc, spotify_added_at, audio_features, genres, assigned_playlist")
    .eq("user_id", userId)
    .eq("needs_review", true)
    .limit(AMBIGUOUS_QUOTA * 2)
    .order("classified_at", { ascending: false });

  const ambiguousRows = ((ambiguous ?? []) as unknown as TrackRow[])
    .sort(() => Math.random() - 0.5)
    .slice(0, AMBIGUOUS_QUOTA);

  // Merge, dedup by track_id
  const seen = new Set<string>();
  const all: TrackRow[] = [];
  for (const row of [...perPlaylistRows, ...ambiguousRows]) {
    if (!seen.has(row.spotify_track_id)) {
      seen.add(row.spotify_track_id);
      all.push(row);
    }
  }

  return all.slice(0, 30);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  // Resolve user
  const supabase = createClient();
  let userId: string;
  let spotifyId: string;

  if (typeof args.user === "string") {
    const { data, error } = await supabase
      .from("users")
      .select("id, spotify_id")
      .eq("spotify_id", args.user)
      .single();
    if (error || !data) {
      console.error(`User "${args.user}" introuvable.`);
      process.exit(1);
    }
    userId = (data as { id: string; spotify_id: string }).id;
    spotifyId = (data as { id: string; spotify_id: string }).spotify_id;
  } else {
    const { data } = await supabase
      .from("users")
      .select("id, spotify_id")
      .eq("cron_enabled", true)
      .limit(1)
      .single();
    if (!data) {
      console.error("Aucun user éligible. Passe --user <spotify_id>.");
      process.exit(1);
    }
    userId = (data as { id: string; spotify_id: string }).id;
    spotifyId = (data as { id: string; spotify_id: string }).spotify_id;
  }

  console.log(`\nBenchmark classifier — user: ${spotifyId}\n`);

  const playlists = await getUserPlaylists(userId);
  if (playlists.length === 0) {
    console.error("Aucune playlist configurée.");
    process.exit(1);
  }

  const tracks = await sampleTracks(userId, playlists);
  if (tracks.length === 0) {
    console.error("Aucun track trouvé en base.");
    process.exit(1);
  }

  const withLlm = args["with-llm"] === true;
  console.log(`Classifying ${tracks.length} tracks (skipLlm=${!withLlm})...\n`);
  if (withLlm) console.log("⚠️  LLM enabled — chaque track = 1 appel Anthropic\n");

  const results: BenchmarkResult[] = [];

  for (const row of tracks) {
    const track: ClassifierTrack = {
      spotify_track_id: row.spotify_track_id,
      spotify_added_at: row.spotify_added_at,
      name: row.name ?? undefined,
      artists: row.artists ?? undefined,
    };

    const result = await classify(
      track,
      row.audio_features,
      row.genres ?? [],
      playlists,
      { skipLlm: !withLlm }
    );

    const suggestedName = playlists.find((p) => p.id === result.playlistId)?.name ?? null;
    const expected = EXPECTED_PLAYLISTS[row.spotify_track_id] ?? null;

    let verdict: BenchmarkResult["verdict"];
    if (expected === null) {
      verdict = result.needsReview ? "needs_review" : "unverified";
    } else if (result.needsReview) {
      verdict = "needs_review";
    } else if (suggestedName === expected) {
      verdict = "correct";
    } else {
      verdict = "wrong";
    }

    results.push({
      track_id: row.spotify_track_id,
      name: row.name ?? row.spotify_track_id,
      artist: row.artists?.[0] ?? "?",
      expected,
      suggested: suggestedName,
      confidence: result.confidence,
      needs_review: result.needsReview,
      level: result.level,
      verdict,
    });
  }

  // ── Stats ─────────────────────────────────────────────────────────────────

  const verified = results.filter((r) => r.expected !== null);
  const correct = results.filter((r) => r.verdict === "correct");
  const wrong = results.filter((r) => r.verdict === "wrong");
  const needsReview = results.filter((r) => r.needs_review);
  const avgConf = results.reduce((s, r) => s + r.confidence, 0) / results.length;

  console.log(`Total : ${results.length} tracks`);
  if (verified.length > 0) {
    console.log(`Correct : ${correct.length} (${pct(correct.length, verified.length)}) — sur ${verified.length} vérifiés`);
    console.log(`Mauvais : ${wrong.length} (${pct(wrong.length, verified.length)})`);
  } else {
    console.log(`Correct : — (aucune expected_playlist définie)`);
  }
  console.log(`Needs review : ${needsReview.length} (${pct(needsReview.length, results.length)}) — cible < 30%`);
  console.log(`Confidence moyenne : ${avgConf.toFixed(2)}`);

  // ── Par playlist (expected ou suggested) ────────────────────────────────

  console.log("\nPar playlist (résultats du classifier) :");
  const byPlaylist = new Map<string, BenchmarkResult[]>();
  for (const r of results) {
    const key = r.suggested ?? "(inbox/null)";
    if (!byPlaylist.has(key)) byPlaylist.set(key, []);
    byPlaylist.get(key)!.push(r);
  }

  for (const [name, group] of [...byPlaylist.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const reviewCount = group.filter((r) => r.needs_review).length;
    const icon = reviewCount === 0 ? "✅" : reviewCount === group.length ? "❌" : "⚠️ ";
    console.log(`  ${name.padEnd(20)} : ${group.length} tracks ${icon}  (${reviewCount} needs_review)`);
  }

  // ── Per-track detail ─────────────────────────────────────────────────────

  console.log("\nDétail :");
  for (const r of results) {
    const verdictIcon = r.verdict === "correct" ? "✅" : r.verdict === "wrong" ? "❌" : r.verdict === "needs_review" ? "⚠️ " : "⬜";
    const expStr = r.expected ? `expected=${r.expected}` : "expected=?";
    const sugStr = r.suggested ?? "null";
    console.log(
      `  ${verdictIcon} ${r.name.slice(0, 30).padEnd(30)} — ${r.artist.slice(0, 20).padEnd(20)} | L${r.level} conf=${r.confidence.toFixed(2)} | ${expStr} → ${sugStr}`
    );
  }

  // ── spotify_track_id list for EXPECTED_PLAYLISTS ─────────────────────────
  if (Object.keys(EXPECTED_PLAYLISTS).length === 0) {
    console.log("\n-- Copie pour EXPECTED_PLAYLISTS (à remplir manuellement) --");
    for (const r of results) {
      console.log(`  "${r.track_id}": "", // ${r.name} — ${r.artist} → ${r.suggested ?? "null"}`);
    }
  }

  console.log("\nTerminé.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
