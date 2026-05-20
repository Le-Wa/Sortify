#!/usr/bin/env node
/**
 * Resets enrichment fields on all tracks and clears classification_log.
 * Tracks stay in DB (name, artists, isrc, etc. preserved).
 *
 * Usage:
 *   npx tsx scripts/reset-enrichment.ts [--user <spotify_user_id>]
 *
 * Omit --user to reset all users.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

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

async function main(): Promise<void> {
  loadEnvFile();

  const args = parseArgs(process.argv.slice(2));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  // Resolve optional --user filter to internal UUID
  let userId: string | null = null;
  if (args.user) {
    const { data, error } = await supabase
      .from("users")
      .select("id")
      .eq("spotify_id", args.user)
      .single();
    if (error || !data) {
      console.error(`User "${args.user}" not found.`);
      process.exit(1);
    }
    userId = data.id as string;
  }

  const scope = userId ? `user ${args.user}` : "all users";
  console.log(`\nResetting enrichment for ${scope}…\n`);

  // 1. Reset enrichment fields on tracks
  const trackUpdate = supabase.from("tracks").update({
    genres:               [],
    audio_features:       null,
    classified_at:        null,
    classification_level: null,
    assigned_playlist:    null,
    needs_review:         false,
  });
  // Supabase requires at least one filter — use a tautology when resetting all users
  if (userId) {
    trackUpdate.eq("user_id", userId);
  } else {
    trackUpdate.neq("id", "00000000-0000-0000-0000-000000000000");
  }

  const { error: trackErr } = await trackUpdate;

  if (trackErr) {
    console.error("Failed to reset tracks:", trackErr.message);
    process.exit(1);
  }
  console.log(`  ✓  tracks reset`);

  // 2. Clear classification_log
  const logDelete = supabase.from("classification_log").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  if (userId) logDelete.eq("user_id", userId);

  const { error: logErr } = await logDelete;
  if (logErr) {
    console.error("Failed to clear classification_log:", logErr.message);
    process.exit(1);
  }
  console.log(`  ✓  classification_log cleared`);

  console.log(`\nDone. Run the cron or classify route to re-enrich.\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
