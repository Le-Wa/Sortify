#!/usr/bin/env node
/**
 * Inserts initial playlist classification rules for a Spotify user.
 * Run once after creating the playlists on Spotify.
 *
 * Usage:
 *   npm run seed -- \
 *     --user    <spotify_user_id>   \
 *     --electro <spotify_playlist_id> \
 *     --techno  <spotify_playlist_id> \
 *     --vibes   <spotify_playlist_id> \
 *     --afro    <spotify_playlist_id> \
 *     --maghreb <spotify_playlist_id> \
 *     --rap     <spotify_playlist_id>
 *
 * Idempotent: re-running updates existing rows (upsert on user_id + spotify_playlist_id).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

// ── Load .env.local ─────────────────────────────────────────────────────────

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
      // Don't overwrite vars already set in the shell
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    // No .env.local → assume vars are set in the environment
  }
}

// ── CLI argument parser ─────────────────────────────────────────────────────

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length - 1; i++) {
    if (argv[i].startsWith("--")) {
      out[argv[i].slice(2)] = argv[i + 1];
      i++;
    }
  }
  return out;
}

// ── Types ───────────────────────────────────────────────────────────────────

interface AudioRange {
  min: number;
  max: number;
}

interface PlaylistRules {
  genres: { include: string[]; exclude: string[] };
  audio_features: Partial<Record<string, AudioRange>>;
  hard_constraints: { max_age_days: number | null; require_genre_signal: boolean };
  priority: number;
}

interface PlaylistSeed {
  spotify_playlist_id: string;
  name: string;
  description: string;
  rules: PlaylistRules;
}

// ── Playlist definitions ─────────────────────────────────────────────────────

function buildSeeds(ids: Record<string, string>): PlaylistSeed[] {
  return [
    {
      spotify_playlist_id: ids.electro,
      name: "Good Electro",
      description: "Dancefloor house et afro house — énergie haute, groove afro ou bass, labels comme Keinemusik. Exclure techno, trance, DnB.",
      rules: {
        genres: {
          include: ["house", "tech house", "afro house", "bass house", "uk garage", "bassline"],
          exclude: [],
        },
        audio_features: {
          energy:       { min: 0.75, max: 1.0 },
          danceability: { min: 0.70, max: 1.0 },
        },
        hard_constraints: { max_age_days: null, require_genre_signal: false },
        priority: 3,
      },
    },
    {
      spotify_playlist_id: ids.techno,
      name: "Good Techno",
      description: "Techno sombre et intense, melodic techno, acid, DnB, trance. Énergie maximale, valence basse.",
      rules: {
        genres: {
          include: ["techno", "melodic techno", "acid techno", "minimal techno", "drum and bass", "trance"],
          exclude: [],
        },
        audio_features: {
          energy:  { min: 0.80, max: 1.0 },
          tempo:   { min: 128,  max: 300  },
          valence: { min: 0.0,  max: 0.45 },
        },
        hard_constraints: { max_age_days: null, require_genre_signal: false },
        priority: 3,
      },
    },
    {
      spotify_playlist_id: ids.vibes,
      name: "Good Vibes",
      description: "Jazz house, organic house, nu jazz, neo soul, French indie pop. Chaleureux, mélodique, mid-tempo. Pas de dancefloor.",
      rules: {
        genres: {
          include: ["jazz house", "organic house", "melodic house", "nu jazz", "neo soul", "french indie pop", "alternative r&b", "uk r&b"],
          exclude: [],
        },
        audio_features: {
          energy: { min: 0.40, max: 0.70 },
        },
        hard_constraints: { max_age_days: null, require_genre_signal: false },
        priority: 2,
      },
    },
    {
      spotify_playlist_id: ids.afro,
      name: "Good Afro",
      description: "Afrobeats, afropop, afroswing. Rythmique solaire, vocaux afro, tempo 90-115 BPM.",
      rules: {
        genres: {
          include: ["afrobeats", "afrobeat", "afropop", "afroswing", "afropiano"],
          exclude: [],
        },
        audio_features: {
          danceability: { min: 0.75, max: 1.0 },
          valence:      { min: 0.60, max: 1.0 },
          tempo:        { min: 90,   max: 115  },
        },
        hard_constraints: { max_age_days: null, require_genre_signal: false },
        priority: 3,
      },
    },
    {
      spotify_playlist_id: ids.maghreb,
      name: "Maghreb United",
      description: "Gnawa, raï, pop marocaine, rap arabe, chaabi, khaleeji. Collection culturelle MENA — priorité maximale sur le signal genre.",
      rules: {
        genres: {
          include: ["gnawa", "rai", "moroccan pop", "moroccan chaabi", "algerian chaabi", "arabic hip hop", "khaleeji", "mahraganat"],
          exclude: [],
        },
        audio_features: {},
        hard_constraints: { max_age_days: null, require_genre_signal: true },
        priority: 4,
      },
    },
    {
      spotify_playlist_id: ids.rap,
      name: "Rap FR",
      description: "Rap français uniquement.",
      rules: {
        genres: {
          include: ["french rap", "rap conscient", "pop urbaine"],
          exclude: [],
        },
        audio_features: {},
        hard_constraints: { max_age_days: null, require_genre_signal: false },
        priority: 2,
      },
    },
  ];
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  loadEnvFile();

  const args = parseArgs(process.argv.slice(2));

  const REQUIRED = ["user", "electro", "techno", "vibes", "afro", "maghreb", "rap"] as const;
  const missing = REQUIRED.filter((k) => !args[k]);

  if (missing.length > 0) {
    console.error(`Missing: ${missing.map((k) => `--${k}`).join(", ")}\n`);
    console.error(
      "Usage:\n  npm run seed -- \\\n" +
      "    --user    <spotify_user_id>     \\\n" +
      "    --electro <spotify_playlist_id> \\\n" +
      "    --techno  <spotify_playlist_id> \\\n" +
      "    --vibes   <spotify_playlist_id> \\\n" +
      "    --afro    <spotify_playlist_id> \\\n" +
      "    --maghreb <spotify_playlist_id> \\\n" +
      "    --rap     <spotify_playlist_id>"
    );
    process.exit(1);
  }

  const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey   = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  // Resolve spotify_id → internal UUID
  const { data: dbUser, error: userErr } = await supabase
    .from("users")
    .select("id")
    .eq("spotify_id", args.user)
    .single();

  if (userErr || !dbUser) {
    console.error(
      `User "${args.user}" not found in the database.\n` +
      "The user must log in at least once before seeding."
    );
    process.exit(1);
  }

  const seeds = buildSeeds(args);
  let ok = 0;

  for (const seed of seeds) {
    const { error } = await supabase.from("playlists").upsert(
      {
        user_id:             dbUser.id,
        spotify_playlist_id: seed.spotify_playlist_id,
        name:                seed.name,
        description:         seed.description,
        rules:               seed.rules,
        enabled:             true,
        centroid:            null,
      },
      { onConflict: "user_id,spotify_playlist_id" }
    );

    if (error) {
      console.error(`  ✗  ${seed.name.padEnd(18)} ${error.message}`);
    } else {
      console.log(`  ✓  ${seed.name}`);
      ok++;
    }
  }

  console.log(`\n${ok} / ${seeds.length} playlists seeded for Spotify user "${args.user}".`);
  if (ok < seeds.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
