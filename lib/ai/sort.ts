import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { claude, responseText, SORT_MODEL } from "../claude";
import { DATA_RULE, titlesBlock, trackLine, type CorpusTrack } from "../corpus";
import type { Axis } from "./fiches";
import { MAX_BACS_PER_TRACK } from "../limits";

export interface SortFiche {
  name: string;
  axis: Axis;
  brief: string;
  examples: string[]; // « Artiste — Titre »
  counterExamples?: string[];
}

export interface Suggestion {
  /** Index du bac dans la liste passée au rangement. */
  bac: number;
  confidence: number;
}

export interface Sorted {
  track_id: string;
  suggestions: Suggestion[];
  reason: string;
}

export { MAX_BACS_PER_TRACK };
const BATCH = 20;

/** Réglages du rangement (le banc d'essai compare des variantes ; l'app utilise les valeurs par défaut). */
export interface SortOptions {
  model?: string;
  effort?: "low" | "medium" | "high";
  batch?: number;
  /**
   * Deux familles rangées séparément : un bac de scène principal (2 au plus),
   * puis 0 à 3 bacs transversaux (ambiance / moment). Par défaut depuis le banc d'essai du 11/10/2026
   * (bacs de scène : 85 → 90 % de rangements justes) ; false pour l'ancien rangement.
   */
  families?: boolean;
  /** Cumul des tokens consommés, pour mesurer le coût. */
  usage?: { input: number; output: number };
}
const CONCURRENCY = 6;

const choice = z.object({ bac: z.number().int(), confiance: z.number() });
const familiesSchema = z.object({
  titres: z.array(
    z.object({
      id: z.number().int(),
      scene: z.array(choice),
      transversal: z.array(choice),
      raison: z.string(),
    }),
  ),
});

const sortSchema = z.object({
  titres: z.array(
    z.object({
      id: z.number().int(),
      bacs: z.array(z.object({ bac: z.number().int(), confiance: z.number() })),
      raison: z.string(),
    }),
  ),
});

function fichesBlock(fiches: SortFiche[], only?: (f: SortFiche) => boolean): string {
  return fiches
    .map((f, i) => ({ f, i }))
    .filter(({ f }) => !only || only(f))
    .map(({ f, i }) => {
      const lines = [`### Bac ${i + 1} — ${f.name} (${f.axis})`, f.brief.trim()];
      if (f.examples.length) lines.push(`Exemples : ${f.examples.join(" ; ")}`);
      if (f.counterExamples?.length) lines.push(`N'y vont pas : ${f.counterExamples.join(" ; ")}`);
      return lines.join("\n");
    })
    .join("\n\n");
}

const SCALE = `La confiance mesure à quel point le titre est à sa place dans CE bac, indépendamment des autres bacs, entre 0 et 1 :
- 0.9 et plus : évident, n'importe quel connaisseur le rangerait là ;
- 0.6 à 0.9 : bonne place, cohérent avec la fiche et les exemples ;
- 0.3 à 0.6 : plausible mais discutable ;
- n'indique pas les bacs sous 0.3.`;

const FORMAT = `Format des titres : numéro | artistes — titre | année | tags | én(ergie) da(nsabilité) va(lence) ac(oustique). Les tags « deezer: » sont des genres d'album Deezer, plus grossiers que les autres.`;

const isScene = (f: SortFiche) => f.axis === "scène";

function familiesPrompt(fiches: SortFiche[]): string {
  return `Tu ranges les likes Spotify d'une personne dans ses bacs (des playlists). Il y a deux familles de bacs.

## Bacs de scène (un genre, une scène)
${fichesBlock(fiches, isScene) || "(aucun)"}

## Bacs transversaux (une ambiance ou un moment, toutes scènes confondues)
${fichesBlock(fiches, (f) => !isScene(f)) || "(aucun)"}

Pour chaque titre, réponds en deux temps, indépendants :
1. « scene » : le bac de scène où il a sa place — un seul en général, deux s'il est vraiment à cheval entre deux scènes. Liste vide si aucune scène ne lui convient.
2. « transversal » : 0 à 3 bacs transversaux où il colle aussi, quelle que soit sa scène. Ne t'en prive pas : c'est ce qui permet à la personne de retrouver un titre dans une ambiance ou un moment, en plus de sa scène.
${SCALE}
Un titre sans aucun bac ira dans la caisse « Divers », c'est normal.
Juge l'ensemble (artiste, titre, époque, énergie, tags) et respecte les frontières décrites dans les fiches : les tags de genre sont des indices, pas des règles.
« raison » : 12 mots au plus, en français, pour expliquer ton choix principal (ou l'absence de bac).
« bac » est le numéro du bac (1 à ${fiches.length}), « id » le numéro du titre.

${FORMAT}

${DATA_RULE}`;
}

function systemPrompt(fiches: SortFiche[]): string {
  return `Tu ranges les likes Spotify d'une personne dans ses bacs (des playlists). Voici les fiches des bacs :

${fichesBlock(fiches)}

Pour chaque titre, indique tous les bacs où il serait à sa place (${MAX_BACS_PER_TRACK} au plus). Un titre a souvent sa place dans deux bacs, par exemple une scène et une ambiance ou un moment : c'est voulu, la personne veut le retrouver partout où il colle.
${SCALE} Si aucun bac ne convient, renvoie une liste vide : le titre ira dans la caisse « Divers », c'est normal.
Juge l'ensemble (artiste, titre, époque, énergie, tags) et respecte les frontières décrites dans les fiches : les tags de genre sont des indices, pas des règles.
« raison » : 12 mots au plus, en français, pour expliquer ton choix principal (ou l'absence de bac).
« bac » est le numéro du bac (1 à ${fiches.length}), « id » le numéro du titre.

Format des titres : numéro | artistes — titre | année | tags | én(ergie) da(nsabilité) va(lence) ac(oustique). Les tags « deezer: » sont des genres d'album Deezer, plus grossiers que les autres.

${DATA_RULE}`;
}

async function sortBatch(
  system: string,
  tracks: CorpusTrack[],
  offset: number,
  fiches: SortFiche[],
  opts: SortOptions,
): Promise<Sorted[]> {
  const bacCount = fiches.length;
  const lines = tracks.map((t, i) => trackLine(t, offset + i)).join("\n");
  const message = await claude().beta.messages.create({
    model: opts.model ?? SORT_MODEL,
    // Repli serveur si le modèle refuse (recommandé pour Sonnet 5.5 sur l'API Claude).
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    max_tokens: 8000,
    output_config: { effort: opts.effort ?? "low", format: opts.families ? zodOutputFormat(familiesSchema) : zodOutputFormat(sortSchema) },
    // Les fiches sont identiques pour tous les lots : on les met en cache.
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: titlesBlock(lines) }],
  });
  if (opts.usage) {
    opts.usage.input += message.usage.input_tokens + (message.usage.cache_read_input_tokens ?? 0) + (message.usage.cache_creation_input_tokens ?? 0);
    opts.usage.output += message.usage.output_tokens;
  }
  const text = responseText(message, "Rangement");
  const valid = (b: { bac: number; confiance: number }) => b.bac >= 1 && b.bac <= bacCount && b.confiance >= 0.3;
  const answers = new Map<number, { bacs: { bac: number; confiance: number }[]; raison: string }>();
  if (opts.families) {
    // Chaque famille garde ses bacs (un bac de scène cité comme transversal est ignoré) : 2 scènes, 3 transversaux au plus.
    for (const t of familiesSchema.parse(JSON.parse(text)).titres) {
      const pick = (list: typeof t.scene, scene: boolean) =>
        list
          .filter((b) => valid(b) && isScene(fiches[b.bac - 1]) === scene)
          .sort((a, b) => b.confiance - a.confiance)
          .slice(0, scene ? 2 : 3);
      answers.set(t.id, { bacs: [...pick(t.scene, true), ...pick(t.transversal, false)], raison: t.raison });
    }
  } else {
    for (const t of sortSchema.parse(JSON.parse(text)).titres) answers.set(t.id, t);
  }

  return tracks.map((track, i) => {
    const answer = answers.get(offset + i);
    const suggestions = (answer?.bacs ?? [])
      .filter(valid)
      .map((b) => ({ bac: b.bac - 1, confidence: Math.min(1, b.confiance) }))
      .filter((s, k, all) => all.findIndex((o) => o.bac === s.bac) === k)
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, MAX_BACS_PER_TRACK);
    return { track_id: track.track_id, suggestions, reason: (answer?.raison.trim() ?? "").slice(0, 160) };
  });
}

/** Erreurs qui méritent de couper le lot en deux plutôt que d'abandonner. */
function isSplittable(error: unknown): boolean {
  if (error instanceof Anthropic.APIError) return false; // réseau et 429/5xx déjà réessayés par le SDK
  return error instanceof Error; // réponse tronquée ou JSON invalide
}

async function sortWithSplit(
  system: string,
  tracks: CorpusTrack[],
  offset: number,
  fiches: SortFiche[],
  opts: SortOptions,
): Promise<Sorted[]> {
  try {
    return await sortBatch(system, tracks, offset, fiches, opts);
  } catch (error) {
    if (tracks.length <= 1 || !isSplittable(error)) throw error;
    console.warn(`Rangement : lot de ${tracks.length} titres coupé en deux (${(error as Error).message})`);
    const half = Math.ceil(tracks.length / 2);
    return [
      ...(await sortWithSplit(system, tracks.slice(0, half), offset, fiches, opts)),
      ...(await sortWithSplit(system, tracks.slice(half), offset + half, fiches, opts)),
    ];
  }
}

/**
 * Range des titres dans les bacs décrits par les fiches.
 * `onBatch` est appelé après chaque lot (progression, sauvegarde au fil de l'eau).
 */
export async function sortTracks(
  fiches: SortFiche[],
  tracks: CorpusTrack[],
  onBatch?: (done: Sorted[]) => Promise<void>,
  opts: SortOptions = {},
): Promise<Sorted[]> {
  const families = opts.families ?? true;
  const system = families ? familiesPrompt(fiches) : systemPrompt(fiches);
  const batches: { tracks: CorpusTrack[]; offset: number }[] = [];
  const size = opts.batch ?? BATCH;
  for (let i = 0; i < tracks.length; i += size) batches.push({ tracks: tracks.slice(i, i + size), offset: i });

  const results: Sorted[] = [];
  let next = 0;
  async function worker() {
    while (next < batches.length) {
      const batch = batches[next++];
      const sorted = await sortWithSplit(system, batch.tracks, batch.offset, fiches, { ...opts, families });
      results.push(...sorted);
      await onBatch?.(sorted);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, batches.length) }, worker));
  return results;
}

const FILL_BATCH = 100;

const fillSchema = z.object({
  titres: z.array(z.object({ id: z.number().int(), confiance: z.number() })),
});

/**
 * Remplit un seul bac : parmi les titres, lesquels y ont leur place (avec leur confiance).
 * Sert après une retouche de la proposition, sans re-ranger toute la bibliothèque.
 */
export async function fillBac(
  fiche: SortFiche,
  neighbours: string[],
  tracks: CorpusTrack[],
): Promise<{ track_id: string; confidence: number }[]> {
  const system = `Tu ranges les likes Spotify d'une personne dans ses bacs (des playlists). Tu t'occupes d'un seul bac :

${fichesBlock([fiche])}

Les autres bacs de la personne (pour situer les frontières) : ${neighbours.join(", ") || "aucun"}.

Parmi les titres donnés, renvoie ceux qui ont leur place dans ce bac, avec une confiance entre 0 et 1 (0.9 : évident ; 0.6 à 0.9 : bonne place ; 0.3 à 0.6 : plausible). N'indique pas les autres. Un titre peut aussi aller dans d'autres bacs : juge seulement s'il est à sa place dans celui-ci.
Format des titres : numéro | artistes — titre | année | tags | én(ergie) da(nsabilité) va(lence) ac(oustique). Les tags « deezer: » sont des genres d'album Deezer, plus grossiers que les autres.

${DATA_RULE}`;

  const batches: { tracks: CorpusTrack[]; offset: number }[] = [];
  for (let i = 0; i < tracks.length; i += FILL_BATCH) batches.push({ tracks: tracks.slice(i, i + FILL_BATCH), offset: i });

  const results: { track_id: string; confidence: number }[] = [];
  let next = 0;
  async function worker() {
    while (next < batches.length) {
      const { tracks: batch, offset } = batches[next++];
      const message = await claude().beta.messages.create({
        model: SORT_MODEL,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        max_tokens: 8000,
        output_config: { effort: "low", format: zodOutputFormat(fillSchema) },
        system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: titlesBlock(batch.map((t, i) => trackLine(t, offset + i)).join("\n")) }],
      });
      const parsed = fillSchema.parse(JSON.parse(responseText(message, "Remplissage d'un bac")));
      for (const t of parsed.titres) {
        const track = batch[t.id - offset];
        if (track && t.confiance >= 0.3) results.push({ track_id: track.track_id, confidence: Math.min(1, t.confiance) });
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, batches.length) }, worker));
  return results;
}
