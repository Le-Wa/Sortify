import "server-only";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { ANALYSIS_MODEL, claude, EDIT_MODEL, responseText } from "../claude";
import { trackLine, type CorpusTrack } from "../corpus";

export const AXES = ["scène", "ambiance", "moment"] as const;
export type Axis = (typeof AXES)[number];

const ficheSchema = z.object({
  name: z.string().describe("Nom du bac : 1 à 4 mots, évocateur, en français (les mots de genre anglais sont permis)."),
  sleeve_name: z
    .string()
    .nullable()
    .describe("Version courte (12 caractères max) si le nom dépasse 16 caractères, sinon null."),
  pitch: z.string().describe("Une phrase pour l'humain, 12 mots max."),
  brief: z.string().describe("3 à 5 lignes pour le rangement : voir les règles."),
  axis: z.enum(AXES),
  examples: z.array(z.number().int()).describe("Numéros de 5 à 8 titres du corpus qui incarnent le bac, artistes variés."),
});
export type Fiche = z.infer<typeof ficheSchema>;

const analysisSchema = z.object({ bacs: z.array(ficheSchema) });

const RULES = `Un bac est une playlist que Sortify remplit tout seul avec les nouveaux likes. Il est défini par une fiche :
- name : court et évocateur, comme un intercalaire chez un disquaire (« Soirée potes », « Dimanche lent », « Rap introspectif », « Électro solaire »). Pas de nom générique (« Mix », « Divers », « Favoris »), pas d'emoji.
- pitch : une phrase pour la personne, qui donne envie.
- brief : 3 à 5 lignes relues par l'IA à chaque rangement. Scène(s) et genres, énergie, ambiance, moment d'écoute ; ce qui est clairement dedans ; ce qui est à la frontière ou dehors (en nommant les bacs voisins avec lesquels il ne faut pas confondre).
- axis : « scène » (un genre ou une scène + une couleur), « ambiance » (une énergie, une humeur) ou « moment » (un usage : soirée, travail, route…).

Ce qui marche (appris sur de vraies bibliothèques) :
- Le meilleur format est « une scène + une couleur » (« Soul nocturne », « Électro solaire »). Un bac de pure ambiance (« Mélancolie ») est trop flou pour ranger de façon fiable ; un bac de pure scène trop large (« Électro ») ne sert à rien.
- Mélange les trois axes : environ deux tiers de bacs « scène », et au moins deux bacs « ambiance » ou « moment » qui traversent plusieurs scènes (un même titre de rap, d'électro ou de soul peut y aller). Ce sont eux qui permettent à un titre de vivre dans plusieurs bacs, et c'est ce que la personne veut.
- Les genres sont des indices, pas des règles : un titre a souvent 4 ou 5 tags, juge l'ensemble (artiste, titre, époque, énergie).
- Un titre peut aller dans plusieurs bacs (3 au plus), c'est voulu, mais deux bacs ne doivent pas se recouvrir largement.`;

/**
 * Analyse de la bibliothèque : propose les bacs qui la résument.
 * Le nombre est libre (rarement moins de 5, rarement plus de 15), dicté par la taille et les directions réelles.
 */
export async function proposeFiches(corpus: CorpusTrack[]): Promise<Fiche[]> {
  const lines = corpus.map((t, i) => trackLine(t, i)).join("\n");
  const minPerBac = Math.max(15, Math.round(corpus.length * 0.03));

  const stream = claude().beta.messages.stream({
    model: ANALYSIS_MODEL,
    max_tokens: 32000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: zodOutputFormat(analysisSchema) },
    system: `Tu es un disquaire passionné. Tu découvres la discothèque de quelqu'un (ses likes Spotify) et tu en tires les bacs qui en résument l'âme.

${RULES}

Ta mission :
- Propose le nombre de bacs que la bibliothèque justifie vraiment : rarement moins de 5, rarement plus de 15. Une petite bibliothèque ou très homogène en mérite moins.
- Chaque bac doit pouvoir accueillir au moins ~${minPerBac} titres du corpus.
- Ensemble, les bacs doivent donner une maison à au moins 85 % des titres. Les titres isolés iront dans la caisse « Divers » : ne crée pas de bac pour eux.
- Ordonne les bacs du plus central au plus marginal dans cette bibliothèque.
- Tout le texte est en français, tutoiement.

Format du corpus, un titre par ligne : numéro | artistes — titre | année de sortie | tags de genre | én(ergie) da(nsabilité) va(lence) ac(oustique) entre 0 et 1 quand on les connaît.`,
    messages: [{ role: "user", content: `Corpus (${corpus.length} titres) :\n${lines}` }],
  });
  const message = await stream.finalMessage();
  const parsed = analysisSchema.parse(JSON.parse(responseText(message, "Analyse de la bibliothèque")));
  return parsed.bacs.map((f) => cleanFiche(f, corpus.length));
}

function cleanFiche(f: Fiche, corpusSize: number): Fiche {
  const examples = [...new Set(f.examples.filter((i) => i >= 0 && i < corpusSize))].slice(0, 8);
  const sleeve = f.sleeve_name?.trim();
  return { ...f, name: f.name.trim(), sleeve_name: sleeve && f.name.trim().length > 16 ? sleeve : null, examples };
}

export interface FicheContext {
  name: string;
  pitch: string;
  axis: Axis;
}

const singleSchema = z.object({ bac: ficheSchema });

async function editFiche(instruction: string, others: FicheContext[], corpus: CorpusTrack[]): Promise<Fiche> {
  const lines = corpus.map((t, i) => trackLine(t, i)).join("\n");
  const neighbours = others.map((o) => `- ${o.name} (${o.axis}) : ${o.pitch}`).join("\n");
  const message = await claude().beta.messages.create({
    model: EDIT_MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: zodOutputFormat(singleSchema) },
    system: `Tu es un disquaire passionné qui organise la discothèque de quelqu'un en bacs.

${RULES}

Les autres bacs de cette discothèque (à ne pas dupliquer) :
${neighbours || "(aucun)"}

Tout le texte est en français, tutoiement. Les exemples sont des numéros de titres du corpus.
Format du corpus : numéro | artistes — titre | année | tags | én da va ac.`,
    messages: [{ role: "user", content: `Corpus :\n${lines}\n\n${instruction}` }],
  });
  const parsed = singleSchema.parse(JSON.parse(responseText(message, "Retouche d'un bac")));
  return cleanFiche(parsed.bac, corpus.length);
}

/** « Autre idée » : un bac différent à la place de celui-ci. */
export function alternativeFiche(current: FicheContext, others: FicheContext[], corpus: CorpusTrack[]) {
  return editFiche(
    `La personne n'aime pas le bac « ${current.name} » (${current.pitch}). Propose une autre idée de bac, vraiment différente, qui a sa place dans cette discothèque et ne double aucun bac existant.`,
    others,
    corpus,
  );
}

/** Fusion de deux bacs : une seule fiche qui couvre les deux, avec un nouveau nom. */
export function mergedFiche(a: FicheContext, b: FicheContext, others: FicheContext[], corpus: CorpusTrack[]) {
  return editFiche(
    `Fusionne ces deux bacs en un seul, avec un nouveau nom et une fiche qui couvre les deux :\n- ${a.name} (${a.axis}) : ${a.pitch}\n- ${b.name} (${b.axis}) : ${b.pitch}`,
    others,
    corpus,
  );
}

/** « Il manque un bac ? » : bac sur mesure à partir d'une description libre. */
export function customFiche(request: string, others: FicheContext[], corpus: CorpusTrack[]) {
  return editFiche(
    `La personne demande un bac sur mesure : « ${request.slice(0, 500)} ». Écris sa fiche (garde l'esprit de la demande, trouve un nom évocateur) et choisis des exemples dans le corpus.`,
    others,
    corpus,
  );
}

const complementSchema = z.object({ bacs: z.array(ficheSchema) });

/**
 * Passe « compléter » (spec 02) : à partir des titres restés sans bac, propose 0 à 2 bacs
 * seulement s'ils forment un groupe cohérent assez grand. Les exemples sont des numéros d'orphelins.
 */
export async function complementFiches(orphans: CorpusTrack[], existing: FicheContext[], minPerBac: number): Promise<Fiche[]> {
  const lines = orphans.map((t, i) => trackLine(t, i)).join("\n");
  const message = await claude().beta.messages.create({
    model: EDIT_MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: zodOutputFormat(complementSchema) },
    system: `Tu es un disquaire passionné qui organise la discothèque de quelqu'un en bacs.

${RULES}

Les bacs existants :
${existing.map((o) => `- ${o.name} (${o.axis}) : ${o.pitch}`).join("\n")}

Tout le texte est en français, tutoiement.
Format des titres : numéro | artistes — titre | année | tags | én da va ac.`,
    messages: [
      {
        role: "user",
        content: `Ces ${orphans.length} titres n'ont trouvé leur place dans aucun bac :\n${lines}\n\nPropose 0, 1 ou 2 nouveaux bacs, uniquement si un groupe cohérent d'au moins ${minPerBac} de ces titres le justifie et qu'il ne double aucun bac existant. Sinon renvoie une liste vide : ces titres iront dans la caisse « Divers », c'est très bien. Les exemples sont des numéros de cette liste.`,
      },
    ],
  });
  const parsed = complementSchema.parse(JSON.parse(responseText(message, "Passe compléter")));
  return parsed.bacs.slice(0, 2).map((f) => cleanFiche(f, orphans.length));
}

const adjustSchema = z.object({ pitch: z.string(), brief: z.string() });

/** « Demande à l'IA de l'ajuster » : réécrit pitch et brief d'un bac selon une consigne libre (le nom ne change pas). */
export async function adjustFiche(
  current: FicheContext & { brief: string },
  instruction: string,
  others: FicheContext[],
): Promise<{ pitch: string; brief: string }> {
  const message = await claude().beta.messages.create({
    model: EDIT_MODEL,
    max_tokens: 8000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: zodOutputFormat(adjustSchema) },
    system: `Tu es un disquaire passionné qui tient à jour les fiches des bacs (playlists) de quelqu'un.

${RULES}

Les autres bacs de la personne :
${others.map((o) => `- ${o.name} (${o.axis}) : ${o.pitch}`).join("\n")}

Tout le texte est en français, tutoiement.`,
    messages: [
      {
        role: "user",
        content: `Bac « ${current.name} » (${current.axis}).\nPitch actuel : ${current.pitch}\nBrief actuel :\n${current.brief}\n\nLa personne demande : « ${instruction.slice(0, 500)} ».\nRéécris le pitch et le brief en tenant compte de sa demande, sans changer l'esprit du bac au-delà de ce qu'elle demande.`,
      },
    ],
  });
  return adjustSchema.parse(JSON.parse(responseText(message, "Ajustement d'un bac")));
}

const reanalysisSchema = z.object({
  changements: z.array(
    z.object({
      type: z.enum(["ajouter", "supprimer", "fusionner"]),
      bacs: z.array(z.number().int()).describe("Numéros des bacs existants concernés : 1 pour supprimer, 2 pour fusionner, aucun pour ajouter."),
      raison: z.string().describe("Une phrase pour la personne : pourquoi ce changement."),
      fiche: ficheSchema.nullable().describe("Fiche du nouveau bac (ajouter) ou du bac fusionné (fusionner) ; null pour supprimer."),
    }),
  ),
});

export interface Change {
  type: "ajouter" | "supprimer" | "fusionner";
  /** Index (base 0) des bacs existants concernés. */
  bacs: number[];
  reason: string;
  fiche: Fiche | null;
}

/**
 * « Relancer l'analyse » (spec 02 §2.5) : relit toute la bibliothèque à la lumière des bacs existants
 * et propose des changements (ajouter, supprimer, fusionner), chacun validé ensuite par la personne.
 */
export async function reanalyse(
  corpus: CorpusTrack[],
  existing: (FicheContext & { brief: string; count: number })[],
): Promise<Change[]> {
  const lines = corpus.map((t, i) => trackLine(t, i)).join("\n");
  const bacs = existing.map((b, i) => `${i + 1}. ${b.name} (${b.axis}, ${b.count} titres) : ${b.pitch}\n   ${b.brief.replace(/\n/g, " ")}`).join("\n");
  const stream = claude().beta.messages.stream({
    model: ANALYSIS_MODEL,
    max_tokens: 32000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium", format: zodOutputFormat(reanalysisSchema) },
    system: `Tu es un disquaire passionné. La personne a déjà des bacs ; ses goûts ont pu évoluer. Tu relis toute sa discothèque et tu proposes des changements, qu'elle validera un par un.

${RULES}

Propose seulement les changements qui valent vraiment le coup (souvent 0 à 3) :
- « ajouter » : une direction réelle de la bibliothèque qui n'a pas de bac (au moins ~${Math.max(15, Math.round(corpus.length * 0.03))} titres) ;
- « supprimer » : un bac devenu marginal ou qui ne correspond plus à ses likes ;
- « fusionner » : deux bacs qui se recouvrent trop.
Si tout va bien, renvoie une liste vide. Tout le texte est en français, tutoiement. Les exemples des fiches sont des numéros de titres du corpus.
Format du corpus : numéro | artistes — titre | année | tags | én da va ac.`,
    messages: [{ role: "user", content: `Bacs actuels :\n${bacs}\n\nCorpus (${corpus.length} titres) :\n${lines}` }],
  });
  const parsed = reanalysisSchema.parse(JSON.parse(responseText(await stream.finalMessage(), "Ré-analyse")));
  const valid: Change[] = [];
  for (const c of parsed.changements) {
    const idx = [...new Set(c.bacs.map((n) => n - 1).filter((i) => i >= 0 && i < existing.length))];
    if (c.type === "ajouter" && c.fiche) valid.push({ type: c.type, bacs: [], reason: c.raison, fiche: cleanFiche(c.fiche, corpus.length) });
    if (c.type === "supprimer" && idx.length === 1) valid.push({ type: c.type, bacs: idx, reason: c.raison, fiche: null });
    if (c.type === "fusionner" && idx.length === 2 && c.fiche) valid.push({ type: c.type, bacs: idx, reason: c.raison, fiche: cleanFiche(c.fiche, corpus.length) });
  }
  return valid;
}
