import "server-only";
import type { Axis, Fiche } from "./ai/fiches";
import type { SortFiche } from "./ai/sort";
import { DIVERS_COLOR, nextColor } from "./bac-colors";
import { uniqueShape } from "./cover-shapes";
import type { CorpusTrack } from "./corpus";
import { check, db } from "./db";

/** Seuil de placement lors de la création (pas encore de « À trier ») : à calibrer sur de vraies bibliothèques. */
export const INITIAL_PLACE_THRESHOLD = 0.5;
/**
 * Seuil des bacs transversaux (ambiance / moment) : sous 0,6, un rangement sur deux y était contesté
 * par le juge au banc d'essai du 11/10/2026.
 */
export const TRANSVERSAL_PLACE_THRESHOLD = 0.6;
/** Un titre n'est rangé que si son meilleur bac atteint ce seuil (tri quotidien et création). */
export const SURE_THRESHOLD = 0.6;

/** Confiance minimale pour placer un titre dans un bac, selon sa famille. */
export function placeThreshold(axis: Axis): number {
  return axis === "scène" ? INITIAL_PLACE_THRESHOLD : TRANSVERSAL_PLACE_THRESHOLD;
}

export interface Bac {
  id: string;
  member_id: string;
  name: string;
  sleeve_name: string | null;
  pitch: string;
  brief: string;
  axis: Axis;
  /** Forme de la pochette (lib/cover-shapes.ts) ; null pour Divers et les anciens bacs. */
  shape: string | null;
  /** Forme en contour (true) ou pleine (false) ; null = selon l'axe. */
  outline: boolean | null;
  color: string;
  position: number;
  /** archived : retiré sur l'écran Proposition, gardé (fiche + exemples, sans titres) pour être récupéré. */
  status: "proposed" | "active" | "removed" | "archived";
  auto_fill: boolean;
  spotify_playlist_id: string | null;
  is_divers: boolean;
  needs_fill: boolean;
  cover_uploaded_at: string | null;
  created_at: string;
}

export async function listBacs(memberId: string, statuses: Bac["status"][]): Promise<Bac[]> {
  const data = check(
    await db()
      .from("bacs")
      .select("*")
      .eq("member_id", memberId)
      .in("status", statuses)
      .eq("is_divers", false)
      .order("position"),
    "Lecture des bacs",
  );
  return data as Bac[];
}

export async function getBac(memberId: string, id: string): Promise<Bac | null> {
  const data = check(
    await db().from("bacs").select("*").eq("member_id", memberId).eq("id", id).maybeSingle(),
    "Lecture du bac",
  );
  return (data as Bac | null) ?? null;
}

/** Enregistre des fiches proposées par l'IA, avec leurs titres exemples. */
export async function insertFiches(
  memberId: string,
  fiches: Fiche[],
  corpus: CorpusTrack[],
  opts: { startPosition: number; usedColors: string[]; usedShapes: (string | null)[]; needsFill: boolean },
): Promise<Bac[]> {
  const used = [...opts.usedColors];
  const shapes = [...opts.usedShapes];
  const rows = fiches.map((f, i) => {
    const color = nextColor(used);
    used.push(color);
    const shape = uniqueShape(f.shape, shapes);
    shapes.push(shape);
    return {
      member_id: memberId,
      name: f.name,
      sleeve_name: f.sleeve_name,
      pitch: f.pitch,
      brief: f.brief,
      axis: f.axis,
      shape,
      color,
      position: opts.startPosition + i,
      status: "proposed",
      needs_fill: opts.needsFill,
    };
  });
  const bacs = check(await db().from("bacs").insert(rows).select("*"), "Création des bacs") as Bac[];
  bacs.sort((a, b) => a.position - b.position);
  await Promise.all(bacs.map((bac, i) => setExamples(memberId, bac.id, fiches[i].examples.map((k) => corpus[k]?.track_id))));
  return bacs;
}

export async function setExamples(memberId: string, bacId: string, trackIds: (string | undefined)[]): Promise<void> {
  check(
    await db().from("bac_examples").delete().eq("bac_id", bacId).eq("polarity", "positive"),
    "Effacement des exemples",
  );
  const ids = [...new Set(trackIds.filter((t): t is string => Boolean(t)))];
  if (ids.length === 0) return;
  check(
    await db()
      .from("bac_examples")
      .insert(ids.map((track_id) => ({ bac_id: bacId, member_id: memberId, track_id, polarity: "positive" }))),
    "Enregistrement des exemples",
  );
}

interface ExampleRow {
  bac_id: string;
  polarity: "positive" | "negative";
  likes: { title: string; artists: string[]; cover_url: string | null; isrc: string | null; track_id: string } | null;
}

export interface Example {
  track_id: string;
  title: string;
  artist: string;
  cover_url: string | null;
  isrc: string | null;
}

/** Exemples (et contre-exemples) de plusieurs bacs, avec les infos du titre. */
export async function examplesFor(bacIds: string[]): Promise<Map<string, { positive: Example[]; negative: Example[] }>> {
  const result = new Map<string, { positive: Example[]; negative: Example[] }>();
  for (const id of bacIds) result.set(id, { positive: [], negative: [] });
  if (bacIds.length === 0) return result;
  const rows = check(
    await db()
      .from("bac_examples")
      .select("bac_id, polarity, likes(track_id, title, artists, cover_url, isrc)")
      .in("bac_id", bacIds)
      .order("added_at"),
    "Lecture des exemples",
  ) as unknown as ExampleRow[];
  for (const row of rows) {
    if (!row.likes) continue;
    const example = {
      track_id: row.likes.track_id,
      title: row.likes.title,
      artist: row.likes.artists[0] ?? "",
      cover_url: row.likes.cover_url,
      isrc: row.likes.isrc,
    };
    result.get(row.bac_id)?.[row.polarity].push(example);
  }
  return result;
}

/** Fiches au format du rangement, dans l'ordre des bacs. */
export async function sortFichesFor(bacs: Bac[]): Promise<SortFiche[]> {
  const examples = await examplesFor(bacs.map((b) => b.id));
  return bacs.map((b) => {
    const ex = examples.get(b.id);
    const label = (e: Example) => `${e.artist} — ${e.title}`;
    return {
      name: b.name,
      axis: b.axis,
      brief: b.brief,
      examples: (ex?.positive ?? []).map(label),
      counterExamples: (ex?.negative ?? []).map(label),
    };
  });
}

/** Remplace les placements IA d'un bac. */
export async function replacePlacements(
  memberId: string,
  bacId: string,
  placements: { track_id: string; confidence: number }[],
): Promise<void> {
  check(await db().from("placements").delete().eq("bac_id", bacId), "Effacement des placements");
  await addPlacements(
    memberId,
    placements.map((p) => ({ ...p, bac_id: bacId })),
  );
}

export async function addPlacements(
  memberId: string,
  placements: { bac_id: string; track_id: string; confidence: number }[],
): Promise<void> {
  const ids = [...new Set(placements.map((p) => p.bac_id))];
  const axes = new Map(
    (check(await db().from("bacs").select("id, axis").in("id", ids), "Lecture des axes") as { id: string; axis: Axis }[]).map((b) => [b.id, b.axis]),
  );
  const rows = placements
    .filter((p) => p.confidence >= placeThreshold(axes.get(p.bac_id) ?? "scène"))
    .map((p) => ({ ...p, member_id: memberId, source: "ia" }));
  for (let i = 0; i < rows.length; i += 500) {
    check(
      await db().from("placements").upsert(rows.slice(i, i + 500), { onConflict: "bac_id,track_id" }),
      "Enregistrement des placements",
    );
  }
}

/** Nombre de titres par bac. */
export async function placementCounts(bacIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>(bacIds.map((id) => [id, 0]));
  await Promise.all(
    bacIds.map(async (id) => {
      const { count, error } = await db().from("placements").select("track_id", { count: "exact", head: true }).eq("bac_id", id);
      if (error) throw new Error(`Comptage du bac : ${error.message}`);
      counts.set(id, count ?? 0);
    }),
  );
  return counts;
}

export async function ensureDivers(memberId: string): Promise<Bac> {
  const existing = check(
    await db().from("bacs").select("*").eq("member_id", memberId).eq("is_divers", true).maybeSingle(),
    "Lecture de Divers",
  );
  if (existing) return existing as Bac;
  return check(
    await db()
      .from("bacs")
      .insert({
        member_id: memberId,
        name: "Divers",
        pitch: "Les titres qui n'ont trouvé leur place nulle part.",
        brief: "Caisse des titres sans bac. Sortify y repasse à chaque nouvelle analyse.",
        axis: "ambiance",
        color: DIVERS_COLOR.bg,
        position: 9999,
        status: "proposed",
        is_divers: true,
      })
      .select("*")
      .single(),
    "Création de Divers",
  ) as Bac;
}
