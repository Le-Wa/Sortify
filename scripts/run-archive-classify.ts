#!/usr/bin/env node
/**
 * Boucle sur la logique d'archive/classify jusqu'à épuisement des tracks non classifiés.
 * Appelle les fonctions directement — pas de session HTTP requise.
 *
 * Usage:
 *   npx tsx scripts/run-archive-classify.ts [--user <spotify_user_id>] [--dry-run]
 *
 * --dry-run : enrichit et log sans écrire en base ni ajouter aux playlists Spotify.
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

// Imports après chargement des env vars
import { classify } from "@/lib/classifier/engine";
import { resolveGenres } from "@/lib/enrichment";
import { getAudioFeaturesBatch, addTrackToPlaylist } from "@/lib/spotify/fetchers";
import { refreshAccessToken } from "@/lib/spotify/token";
import {
  getCronEnabledUsers,
  getUserBySpotifyId,
  getUserPlaylists,
  getUnorganizedTracks,
  upsertTrack,
  insertClassificationLog,
  updatePlaylistCentroid,
  getPlaylistAssignedFeatures,
} from "@/lib/supabase/queries";
import { createClient } from "@/lib/supabase/client";
import type { PlaylistCentroid } from "@/lib/types";

// ── Config ────────────────────────────────────────────────────────────────────

const BATCH_SIZE = 5;
const DELAY_MS = 500; // pause entre batches pour ménager les APIs externes

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseArgs(argv: string[]): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--dry-run") { out["dry-run"] = true; continue; }
    if (argv[i].startsWith("--") && i + 1 < argv.length) {
      out[argv[i].slice(2)] = argv[i + 1];
      i++;
    }
  }
  return out;
}

function pct(n: number): string {
  return `${Math.round(n * 100)} %`;
}

type CentroidDim = keyof Omit<PlaylistCentroid, "sample_size">;
const CENTROID_DIMS: CentroidDim[] = ["energy", "danceability", "valence", "acousticness", "instrumentalness"];

async function recalculateCentroid(userId: string, playlistId: string): Promise<void> {
  const featureRows = await getPlaylistAssignedFeatures(userId, playlistId);
  if (featureRows.length === 0) return;
  const sums: Record<CentroidDim, number> = { energy: 0, danceability: 0, valence: 0, acousticness: 0, instrumentalness: 0 };
  let count = 0;
  for (const af of featureRows) {
    if (!af) continue;
    for (const dim of CENTROID_DIMS) sums[dim] += (af as Record<CentroidDim, number>)[dim] ?? 0;
    count++;
  }
  if (count === 0) return;
  await updatePlaylistCentroid(playlistId, {
    energy: sums.energy / count,
    danceability: sums.danceability / count,
    valence: sums.valence / count,
    acousticness: sums.acousticness / count,
    instrumentalness: sums.instrumentalness / count,
    sample_size: count,
  });
}

// ── Per-user loop ─────────────────────────────────────────────────────────────

async function processUser(
  userId: string,
  spotifyId: string,
  dryRun: boolean
): Promise<void> {
  const [playlists, token] = await Promise.all([
    getUserPlaylists(userId),
    refreshAccessToken(spotifyId),
  ]);

  if (playlists.length === 0) {
    console.log("  Aucune playlist configurée — skip.\n");
    return;
  }

  let totalProcessed = 0;
  let totalClassified = 0;
  let totalReview = 0;
  let round = 0;

  while (true) {
    const allRows = await getUnorganizedTracks(userId);
    if (allRows.length === 0) break;

    round++;
    const batch = allRows.slice(0, BATCH_SIZE);
    const remaining = allRows.length - batch.length;
    console.log(`  Batch ${round} — ${batch.length} tracks (${remaining} restants)`);

    // Audio features (ISRC-based)
    const tracksWithIsrc = batch
      .filter((r) => r.isrc)
      .map((r) => ({ id: r.spotify_track_id, isrc: r.isrc! }));

    let featuresMap = new Map<string, Awaited<ReturnType<typeof getAudioFeaturesBatch>>[number]>();
    try {
      const list = await getAudioFeaturesBatch(tracksWithIsrc, token);
      featuresMap = new Map(list.map((f) => [f.id, f]));
    } catch {
      console.log("  ⚠  ReccoBeats indisponible — classification genre-only");
    }

    const affectedPlaylists = new Set<string>();

    for (const row of batch) {
      const label = `${row.name ?? row.spotify_track_id} — ${row.artists?.[0] ?? "?"}`;

      // Enrichissement genres
      const genres = await resolveGenres(row.isrc ?? undefined, row.artists?.[0] ?? "", row.name ?? "");
      const features = featuresMap.get(row.spotify_track_id) ?? null;

      // Log enrichissement
      const genreStr = genres.length ? genres.join(", ") : "(vide)";
      const featStr = features
        ? `E=${pct(features.energy ?? 0)} D=${pct(features.danceability ?? 0)} V=${pct(features.valence ?? 0)}`
        : "features=null";
      console.log(`    ${label}`);
      console.log(`      genres  : ${genreStr}`);
      console.log(`      features: ${featStr}`);

      // Classification
      const result = await classify(
        {
          spotify_track_id: row.spotify_track_id,
          spotify_added_at: row.spotify_added_at,
          name: row.name ?? undefined,
          artists: row.artists ?? undefined,
        },
        features,
        genres,
        playlists,
        { skipLlm: true }
      );

      const playlistName = playlists.find((p) => p.id === result.playlistId)?.name ?? "inbox";
      console.log(`      → L${result.level} · ${playlistName} · conf=${pct(result.confidence)}${result.needsReview ? " · review" : ""}`);

      if (dryRun) continue;

      // Persistance
      const { id: trackDbId } = await upsertTrack({
        user_id: userId,
        spotify_track_id: row.spotify_track_id,
        spotify_added_at: row.spotify_added_at,
        name: row.name ?? null,
        artists: row.artists ?? null,
        audio_features: features,
        genres,
        assigned_playlist: result.playlistId,
        classified_at: new Date().toISOString(),
        classification_level: result.level,
        needs_review: result.needsReview,
      });

      if (result.playlistId && result.confidence >= 0.60) {
        const playlist = playlists.find((p) => p.id === result.playlistId)!;
        await addTrackToPlaylist(token, playlist.spotify_playlist_id, row.spotify_track_id);
        affectedPlaylists.add(result.playlistId);
        totalClassified++;
      } else {
        totalReview++;
      }

      await insertClassificationLog({
        track_id: trackDbId,
        user_id: userId,
        level_used: result.level,
        suggested: result.playlistId,
        confidence: result.confidence,
        reason: result.reason ?? null,
      });

      totalProcessed++;
    }

    if (!dryRun) {
      for (const playlistId of affectedPlaylists) {
        await recalculateCentroid(userId, playlistId);
      }
    }

    if (remaining === 0) break;
    await new Promise((r) => setTimeout(r, DELAY_MS));
  }

  console.log(
    `\n  Résultat : ${totalProcessed} traités · ${totalClassified} classifiés · ${totalReview} en review\n`
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const dryRun = args["dry-run"] === true;
  const spotifyIdFilter = typeof args.user === "string" ? args.user : null;

  if (dryRun) console.log("\n[DRY RUN — aucune écriture en base]\n");

  let users: { id: string; spotify_id: string }[];

  if (spotifyIdFilter) {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("users")
      .select("id, spotify_id")
      .eq("spotify_id", spotifyIdFilter)
      .single();
    if (error || !data) {
      console.error(`User "${spotifyIdFilter}" introuvable.`);
      process.exit(1);
    }
    users = [data as { id: string; spotify_id: string }];
  } else {
    users = await getCronEnabledUsers();
  }

  if (users.length === 0) {
    console.log("Aucun user éligible.");
    return;
  }

  for (const user of users) {
    console.log(`\nUser ${user.spotify_id}`);
    await processUser(user.id, user.spotify_id, dryRun);
  }

  console.log("Terminé.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
