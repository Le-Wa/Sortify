#!/usr/bin/env node
/**
 * Backfill audio_features manquants via ReccoBeats (ISRC-based, pas d'auth requise).
 *
 * Usage:
 *   npx tsx scripts/backfill-audio-features.ts [--dry-run]
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
  } catch { /* no .env.local */ }
}

loadEnvFile();

import { getAudioFeatures } from "@/lib/enrichment/reccobeats";
import { createClient } from "@/lib/supabase/client";

const DELAY_MS = 150; // ReccoBeats est tolérant mais on ménage quand même
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function pct(n: number, total: number) {
  return `${Math.round((n / total) * 100)}%`;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  if (dryRun) console.log("\n[DRY RUN — aucune écriture]\n");

  const sb = createClient();

  // Toutes les tracks avec ISRC mais sans audio_features
  const { data: tracks, error } = await sb
    .from("tracks")
    .select("id, spotify_track_id, name, artists, isrc")
    .not("isrc", "is", null)
    .is("audio_features", null);

  if (error) { console.error("Supabase error:", error.message); process.exit(1); }
  if (!tracks || tracks.length === 0) { console.log("Rien à backfiller — toutes les tracks ont déjà leurs features."); return; }

  console.log(`\n${tracks.length} tracks sans audio_features. Début du backfill...\n`);

  let ok = 0;
  let empty = 0;
  let failed = 0;

  for (let i = 0; i < tracks.length; i++) {
    const t = tracks[i] as { id: string; spotify_track_id: string; name: string | null; artists: string[] | null; isrc: string };
    const label = `${t.name ?? t.spotify_track_id} — ${t.artists?.[0] ?? "?"}`;

    const features = await getAudioFeatures(t.isrc);

    if (!features) {
      console.log(`  [${i + 1}/${tracks.length}] ❌  ${label} (ReccoBeats: vide)`);
      empty++;
    } else {
      const summary = `E=${features.energy.toFixed(2)} D=${features.danceability.toFixed(2)} T=${Math.round(features.tempo)}bpm`;
      console.log(`  [${i + 1}/${tracks.length}] ✅  ${label} | ${summary}`);

      if (!dryRun) {
        const { error: upsertErr } = await sb
          .from("tracks")
          .update({ audio_features: features })
          .eq("id", t.id);

        if (upsertErr) {
          console.error(`    ↳ Erreur DB: ${upsertErr.message}`);
          failed++;
          continue;
        }
      }
      ok++;
    }

    if (i < tracks.length - 1) await sleep(DELAY_MS);
  }

  console.log(`\nRésultat : ${ok} features stockées · ${empty} vides (ReccoBeats inconnu) · ${failed} erreurs DB`);
  console.log(`Couverture : ${ok}/${tracks.length} (${pct(ok, tracks.length)})`);
}

main().catch((e) => { console.error(e); process.exit(1); });
