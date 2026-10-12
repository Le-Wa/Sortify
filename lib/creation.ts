import "server-only";
import { ensureDivers, listBacs, placementCounts, type Bac } from "./bacs";
import { loadCorpus } from "./corpus";
import { coverJpegBase64 } from "./cover";
import { markFor, type SleeveMark } from "./cover-shapes";
import { check, db } from "./db";
import { kickJob, saveProgress, startJob, type Job } from "./jobs";
import { spotify } from "./spotify/client";
import { append } from "./spotify/playlists";

export interface CreationBac {
  id: string;
  name: string;
  sleeve: string;
  mark: SleeveMark;
  color: string;
  position: number;
  is_divers: boolean;
  total: number;
  added: number;
  done: boolean;
}

export interface CreationProgress {
  phase: "playlists" | "done";
  bacs: CreationBac[];
}

const ADD_CHUNK = 100; // limite Spotify par appel

/**
 * Valide la proposition : renumérote les bacs gardés, remplit Divers avec les titres sans bac,
 * puis lance le job qui crée les playlists dans Spotify.
 */
export async function startCreation(memberId: string): Promise<Job<CreationProgress>> {
  const kept = await listBacs(memberId, ["proposed"]);
  if (kept.length === 0) throw new Error("Garde au moins un bac.");

  await Promise.all(
    kept.map(async (bac, position) => {
      check(await db().from("bacs").update({ position }).eq("id", bac.id), "Ordre des bacs");
      bac.position = position;
    }),
  );

  const divers = await ensureDivers(memberId);
  await fillDivers(memberId, divers, kept);

  const all = [...kept, divers];
  const counts = await placementCounts(all.map((b) => b.id));
  const progress: CreationProgress = {
    phase: "playlists",
    bacs: all.map((b) => ({
      id: b.id,
      name: b.name,
      sleeve: b.sleeve_name ?? b.name,
      mark: markFor(b),
      color: b.color,
      position: b.position,
      is_divers: b.is_divers,
      total: counts.get(b.id) ?? 0,
      added: 0,
      done: false,
    })),
  };
  const job = await startJob(memberId, "creation", progress);
  await kickJob(job.id);
  return job;
}

async function fillDivers(memberId: string, divers: Bac, kept: Bac[]): Promise<void> {
  check(await db().from("placements").delete().eq("bac_id", divers.id), "Effacement de Divers");
  const placed = new Set<string>();
  for (const bac of kept) {
    for (let from = 0; ; from += 1000) {
      const rows = check(
        await db().from("placements").select("track_id").eq("bac_id", bac.id).range(from, from + 999),
        "Lecture des placements",
      ) as { track_id: string }[];
      for (const r of rows) placed.add(r.track_id);
      if (rows.length < 1000) break;
    }
  }
  const orphans = (await loadCorpus(memberId)).filter((t) => !placed.has(t.track_id));
  for (let i = 0; i < orphans.length; i += 500) {
    check(
      await db()
        .from("placements")
        .insert(orphans.slice(i, i + 500).map((t) => ({ bac_id: divers.id, member_id: memberId, track_id: t.track_id, source: "ia" }))),
      "Remplissage de Divers",
    );
  }
}

export async function runCreationStep(job: Job<CreationProgress>, deadline: number): Promise<CreationProgress> {
  let progress = job.progress;
  do {
    progress = await creationUnit(job.member_id, progress);
    await saveProgress(job.id, progress);
  } while (Date.now() < deadline && progress.phase !== "done");
  return progress;
}

async function creationUnit(memberId: string, progress: CreationProgress): Promise<CreationProgress> {
  const pending = progress.bacs.find((b) => !b.done);
  if (!pending) {
    await finalize(memberId);
    return { ...progress, phase: "done" };
  }
  const bac = check(await db().from("bacs").select("*").eq("id", pending.id).single(), "Lecture du bac") as Bac;
  const playlistId = bac.spotify_playlist_id ?? (await createPlaylist(memberId, bac));
  if (!bac.cover_uploaded_at) await uploadCover(memberId, { ...bac, spotify_playlist_id: playlistId });

  const added = await addNextChunk(memberId, bac.id, playlistId);
  return {
    ...progress,
    bacs: progress.bacs.map((b) =>
      b.id === bac.id ? { ...b, added: b.added + added, done: added < ADD_CHUNK } : b,
    ),
  };
}

export async function createPlaylist(memberId: string, bac: Bac): Promise<string> {
  const playlist = await spotify<{ id: string }>(memberId, "/me/playlists", {
    method: "POST",
    json: { name: bac.name, description: bac.pitch.slice(0, 300), public: false },
  });
  // Enregistré tout de suite : un passage interrompu ne recrée pas la playlist.
  check(await db().from("bacs").update({ spotify_playlist_id: playlist.id }).eq("id", bac.id), "Lien vers la playlist");
  return playlist.id;
}

/** Pochette Sortify. Un échec n'arrête pas la création : on réessaiera au prochain tri (spec 01). */
export async function uploadCover(memberId: string, bac: Bac): Promise<void> {
  try {
    const jpeg = await coverJpegBase64(bac);
    await spotify(memberId, `/playlists/${bac.spotify_playlist_id}/images`, {
      method: "PUT",
      headers: { "Content-Type": "image/jpeg" },
      body: jpeg,
    });
    check(
      await db().from("bacs").update({ cover_uploaded_at: new Date().toISOString() }).eq("id", bac.id),
      "Pochette envoyée",
    );
  } catch (error) {
    console.warn(`Pochette de « ${bac.name} » non envoyée :`, error instanceof Error ? error.message : error);
  }
}

/** Ajoute les 100 titres suivants, du plus récent au plus ancien : les nouveaux restent en haut. */
async function addNextChunk(memberId: string, bacId: string, playlistId: string): Promise<number> {
  const rows = check(
    await db()
      .from("likes")
      .select("track_id, liked_at, placements!inner(bac_id, synced_at)")
      .eq("member_id", memberId)
      .eq("placements.bac_id", bacId)
      .is("placements.synced_at", null)
      .order("liked_at", { ascending: false })
      .limit(ADD_CHUNK),
    "Lecture des titres à ajouter",
  ) as { track_id: string }[];
  if (rows.length === 0) return 0;

  await append(memberId, playlistId, rows.map((r) => r.track_id));
  check(
    await db()
      .from("placements")
      .update({ synced_at: new Date().toISOString() })
      .eq("bac_id", bacId)
      .in(
        "track_id",
        rows.map((r) => r.track_id),
      ),
    "Titres ajoutés",
  );
  return rows.length;
}

/** Tout est dans Spotify : les bacs gardés deviennent actifs, les retirés sont mis de côté (récupérables depuis Bacs). */
async function finalize(memberId: string): Promise<void> {
  check(
    await db().from("bacs").update({ status: "active", needs_fill: false }).eq("member_id", memberId).eq("status", "proposed"),
    "Activation des bacs",
  );
  const removed = check(
    await db().from("bacs").update({ status: "archived", needs_fill: false }).eq("member_id", memberId).eq("status", "removed").select("id"),
    "Mise de côté des bacs retirés",
  ) as { id: string }[];
  // Leurs titres ne comptent plus nulle part : on les retrouvera dans toute la bibliothèque au moment de la récupération.
  if (removed.length) check(await db().from("placements").delete().in("bac_id", removed.map((b) => b.id)), "Titres des bacs mis de côté");
}
