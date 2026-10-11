import "server-only";
import { complementFiches, reanalyse, type Fiche } from "./ai/fiches";
import { fillBac } from "./ai/sort";
import { createActiveBac, detachBac, diversTracks, mergeActive } from "./bac-admin";
import { ensureDivers, listBacs, placeThreshold, placementCounts } from "./bacs";
import { loadCorpus, sampleCorpus, type CorpusTrack } from "./corpus";
import { check, db } from "./db";
import { saveProgress, type Job } from "./jobs";
import { getMember } from "./members";

/** Un nouveau bac depuis Divers ne vaut le coup qu'à partir de ce nombre de titres cohérents (spec 02 §2.5). */
const MIN_FROM_DIVERS = 15;
const DIVERS_CHECK_EVERY_MS = 7 * 24 * 3600 * 1000;

export interface SuggestionPayload {
  reason: string;
  /** ajouter / fusionner */
  fiche?: Fiche & { exampleIds: string[] };
  /** ajouter depuis Divers : titres de la caisse qui iraient dans le nouveau bac */
  trackIds?: string[];
  /** supprimer / fusionner */
  bacIds?: string[];
  bacNames?: string[];
}

export interface Suggestion {
  id: string;
  kind: "ajouter" | "supprimer" | "fusionner";
  origin: "divers" | "reanalyse";
  payload: SuggestionPayload;
  created_at: string;
}

export async function openSuggestions(memberId: string): Promise<Suggestion[]> {
  const data = check(
    await db().from("suggestions").select("id, kind, origin, payload, created_at").eq("member_id", memberId).eq("status", "open").order("created_at"),
    "Lecture des suggestions",
  );
  return data as Suggestion[];
}

async function insertSuggestion(
  memberId: string,
  s: Omit<Suggestion, "id" | "created_at">,
  status: "open" | "refused" = "open",
): Promise<void> {
  check(await db().from("suggestions").insert({ member_id: memberId, ...s, status }), "Enregistrement d'une suggestion");
}

/** Vérification de Divers sans résultat : notée (déjà « refusée ») pour ne pas relancer l'IA à chaque tri. */
const noteEmptyCheck = (memberId: string, reason: string) =>
  insertSuggestion(memberId, { kind: "ajouter", origin: "divers", payload: { reason } }, "refused");

const examples = (fiche: Fiche, corpus: CorpusTrack[]): string[] =>
  fiche.examples.map((i) => corpus[i]?.track_id).filter((t): t is string => Boolean(t));

/**
 * Après un tri : si Divers contient assez de titres qui vont ensemble, propose un nouveau bac (une fois par semaine au plus,
 * seulement si la personne a laissé les suggestions activées et n'a pas déjà une suggestion en attente).
 */
export async function suggestFromDivers(memberId: string): Promise<void> {
  const member = await getMember(memberId);
  if (!member?.suggest_bacs) return;
  const recent = check(
    await db().from("suggestions").select("status, created_at").eq("member_id", memberId).eq("origin", "divers").order("created_at", { ascending: false }).limit(1),
    "Dernière suggestion",
  ) as { status: string; created_at: string }[];
  if (recent[0] && (recent[0].status === "open" || Date.now() - Date.parse(recent[0].created_at) < DIVERS_CHECK_EVERY_MS)) return;

  const { total } = await diversTracks(memberId, 1);
  if (total < MIN_FROM_DIVERS) return;
  const divers = await ensureDivers(memberId);
  const inDivers = new Set(
    (check(await db().from("placements").select("track_id").eq("bac_id", divers.id), "Lecture de Divers") as { track_id: string }[]).map((r) => r.track_id),
  );
  const orphans = (await loadCorpus(memberId)).filter((t) => inDivers.has(t.track_id));
  const bacs = await listBacs(memberId, ["active"]);
  const [fiche] = await complementFiches(
    orphans,
    bacs.map((b) => ({ name: b.name, pitch: b.pitch, axis: b.axis })),
    MIN_FROM_DIVERS,
  );
  if (!fiche) return noteEmptyCheck(memberId, "Aucun groupe assez cohérent dans Divers.");
  const matches = (
    await fillBac({ name: fiche.name, axis: fiche.axis, brief: fiche.brief, examples: [] }, bacs.map((b) => b.name), orphans)
  ).filter((m) => m.confidence >= placeThreshold(fiche.axis));
  if (matches.length < MIN_FROM_DIVERS) return noteEmptyCheck(memberId, `Seulement ${matches.length} titres pour « ${fiche.name} ».`);
  await insertSuggestion(memberId, {
    kind: "ajouter",
    origin: "divers",
    payload: {
      reason: `${matches.length} titres de Divers vont ensemble.`,
      fiche: { ...fiche, exampleIds: examples(fiche, orphans) },
      trackIds: matches.map((m) => m.track_id),
    },
  });
}

export interface ReanalyseProgress {
  phase: "analyse" | "done";
  changes: number;
}

/** Job « Relancer l'analyse » : l'IA relit la bibliothèque et dépose ses propositions sur l'Accueil. */
export async function runReanalyseStep(job: Job<ReanalyseProgress>): Promise<ReanalyseProgress> {
  const memberId = job.member_id;
  const corpus = sampleCorpus(await loadCorpus(memberId));
  const bacs = await listBacs(memberId, ["active"]);
  const counts = await placementCounts(bacs.map((b) => b.id));
  const changes = await reanalyse(
    corpus,
    bacs.map((b) => ({ name: b.name, pitch: b.pitch, axis: b.axis, brief: b.brief, count: counts.get(b.id) ?? 0 })),
  );
  // Les anciennes propositions de ré-analyse non traitées sont remplacées.
  check(
    await db().from("suggestions").update({ status: "refused" }).eq("member_id", memberId).eq("status", "open").eq("origin", "reanalyse"),
    "Anciennes propositions",
  );
  for (const c of changes) {
    const targets = c.bacs.map((i) => bacs[i]);
    await insertSuggestion(memberId, {
      kind: c.type,
      origin: "reanalyse",
      payload: {
        reason: c.reason,
        fiche: c.fiche ? { ...c.fiche, exampleIds: examples(c.fiche, corpus) } : undefined,
        bacIds: targets.map((b) => b.id),
        bacNames: targets.map((b) => b.name),
      },
    });
  }
  const progress: ReanalyseProgress = { phase: "done", changes: changes.length };
  await saveProgress(job.id, progress);
  return progress;
}

export async function refuseSuggestion(memberId: string, id: string): Promise<void> {
  check(await db().from("suggestions").update({ status: "refused" }).eq("member_id", memberId).eq("id", id), "Refus de la suggestion");
}

/** Applique une suggestion : nouveau bac (playlist créée), retrait d'un bac, ou fusion. */
export async function acceptSuggestion(memberId: string, id: string): Promise<string> {
  const s = check(
    await db().from("suggestions").select("*").eq("member_id", memberId).eq("id", id).eq("status", "open").maybeSingle(),
    "Lecture de la suggestion",
  ) as (Suggestion & { status: string }) | null;
  if (!s) throw new Error("Cette suggestion n'est plus d'actualité.");
  const p = s.payload;
  let done: string;
  switch (s.kind) {
    case "ajouter": {
      if (!p.fiche) throw new Error("Suggestion incomplète.");
      const preset = p.trackIds?.map((track_id) => ({ track_id, confidence: null }));
      await createActiveBac(memberId, p.fiche, p.fiche.exampleIds, preset);
      done = `« ${p.fiche.name} » est créé dans Spotify.`;
      break;
    }
    case "supprimer": {
      const [bacId] = p.bacIds ?? [];
      if (!bacId) throw new Error("Suggestion incomplète.");
      await detachBac(memberId, bacId);
      done = `« ${p.bacNames?.[0] ?? "Le bac"} » ne fait plus partie de Sortify (la playlist reste dans Spotify).`;
      break;
    }
    case "fusionner": {
      const [a, b] = p.bacIds ?? [];
      if (!a || !b || !p.fiche) throw new Error("Suggestion incomplète.");
      await mergeActive(memberId, a, b, p.fiche, p.fiche.exampleIds);
      done = `« ${p.fiche.name} » réunit les deux bacs (les anciennes playlists restent dans Spotify).`;
      break;
    }
  }
  check(await db().from("suggestions").update({ status: "accepted" }).eq("id", s.id), "Suggestion acceptée");
  return done;
}
