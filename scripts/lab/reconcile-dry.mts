// Essai à blanc de la réconciliation Spotify (rien n'est modifié).
import { db } from "@/lib/db";
import { reconcileSpotify } from "@/lib/reconcile";

const { data: m } = await db().from("members").select("spotify_id").limit(1).single();
const t0 = Date.now();
const stats = await reconcileSpotify(m!.spotify_id, { dryRun: true });
console.log(`${((Date.now() - t0) / 1000).toFixed(1)} s`, { unliked: stats.unliked, removed: stats.removedInSpotify, added: stats.addedInSpotify });
for (const d of stats.details) console.log("-", d);
