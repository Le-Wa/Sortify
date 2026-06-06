#!/usr/bin/env node
/**
 * Vide toutes les playlists Spotify gérées par Sortify.
 * Ne touche pas la DB — uniquement les playlists Spotify.
 *
 * Usage:
 *   npx tsx scripts/clear-spotify-playlists.ts --user <spotify_user_id>
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
    // no .env.local → env vars déjà présentes
  }
}

function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length - 1; i++) {
    if (argv[i].startsWith("--")) { out[argv[i].slice(2)] = argv[i + 1]; i++; }
  }
  return out;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnySupabase = ReturnType<typeof createClient<any>>;

interface UserRow { access_token: string; refresh_token: string; expires_at: number }

async function getSpotifyToken(supabase: AnySupabase, spotifyId: string): Promise<string> {
  const { data: user, error } = await supabase
    .from("users")
    .select("access_token, refresh_token, expires_at")
    .eq("spotify_id", spotifyId)
    .single<UserRow>();
  if (error || !user) throw new Error(`Utilisateur "${spotifyId}" introuvable en DB.`);

  // Force refresh to ensure scopes are up to date
  const MARGIN = 5 * 60;
  const isExpired = Math.floor(Date.now() / 1000) >= user.expires_at - MARGIN;
  if (!isExpired) {
    console.log(`  (token valide jusqu'à ${new Date(user.expires_at * 1000).toISOString()}, force refresh quand même)`);
  }

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(
        `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
      ).toString("base64")}`,
    },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: user.refresh_token }),
  });
  const data = await res.json() as { access_token?: string; refresh_token?: string; expires_in?: number; error?: string };
  if (!res.ok) throw new Error(`Token refresh échoué : ${data.error}`);

  await supabase.from("users").update({
    access_token: data.access_token,
    refresh_token: data.refresh_token ?? user.refresh_token,
    expires_at: Math.floor(Date.now() / 1000) + (data.expires_in ?? 3600),
  }).eq("spotify_id", spotifyId);

  return data.access_token!;
}

async function clearPlaylist(token: string, playlistId: string, playlistName: string): Promise<void> {
  // Check owner first
  const infoRes = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (infoRes.ok) {
    const info = await infoRes.json() as { owner?: { id: string }; tracks?: { total: number }; collaborative?: boolean; public?: boolean };
    console.log(`  → ${playlistName}: owner=${info.owner?.id}, tracks=${info.tracks?.total}, public=${info.public}, collab=${info.collaborative}`);
  } else {
    const body = await infoRes.text().catch(() => "");
    console.log(`  → ${playlistName}: GET HTTP ${infoRes.status}: ${body}`);
  }

  const res = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ uris: [] }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`PUT playlist ${playlistId} — HTTP ${res.status}: ${body}`);
  }
  console.log(`  ✓ ${playlistName} — vidée`);
}

async function main(): Promise<void> {
  loadEnvFile();

  const args = parseArgs(process.argv.slice(2));
  if (!args.user) {
    console.error("Usage: npx tsx scripts/clear-spotify-playlists.ts --user <spotify_user_id>");
    process.exit(1);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error("NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant.");
    process.exit(1);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createClient<any>(supabaseUrl, serviceKey);

  const { data: dbUser, error: userErr } = await supabase
    .from("users")
    .select("id")
    .eq("spotify_id", args.user)
    .single();
  if (userErr || !dbUser) { console.error(`Utilisateur "${args.user}" introuvable.`); process.exit(1); }

  const { data: playlists, error: plErr } = await supabase
    .from("playlists")
    .select("name, spotify_playlist_id")
    .eq("user_id", dbUser.id)
    .not("spotify_playlist_id", "is", null);
  if (plErr) { console.error("Erreur lecture playlists:", plErr.message); process.exit(1); }
  if (!playlists?.length) { console.log("Aucune playlist trouvée."); process.exit(0); }

  const token = args.token ?? await getSpotifyToken(supabase, args.user);
  if (args.token) console.log("  (token passé manuellement via --token)");

  console.log(`\nVidage de ${playlists.length} playlist(s) Spotify…\n`);
  for (const pl of playlists) {
    try {
      await clearPlaylist(token, pl.spotify_playlist_id as string, pl.name as string);
    } catch (err) {
      console.error(`  ✗ ${pl.name} — ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  console.log("\nTerminé.\n");
}

main().catch((err) => { console.error(err); process.exit(1); });
