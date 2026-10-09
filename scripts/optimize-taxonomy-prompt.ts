#!/usr/bin/env node
/**
 * Optimize the taxonomy prompt by testing multiple variants against a user's enriched tracks.
 *
 * Usage:
 *   npx tsx scripts/optimize-taxonomy-prompt.ts --user-id <db-user-id>
 *
 * Options:
 *   --user-id <id>        Supabase user UUID (required)
 *   --segmentation <s>    fine|medium|coarse — sets target playlist range (default: medium)
 *   --variants <n>        Number of prompt variants to test (default: 8)
 *   --sample <n>          Limit to first N enriched tracks (default: 200)
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

function loadEnv(filename = ".env.local"): void {
  try {
    const raw = readFileSync(join(process.cwd(), filename), "utf-8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq < 0) continue;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = val;
    }
  } catch { /* ignore */ }
}

loadEnv();

interface TrackRow {
  name: string;
  artists: string[];
  genres: string[] | null;
  audio_features: Record<string, number> | null;
}

interface ProposedPlaylist {
  name: string;
  genres_include: string[];
  description?: string;
  llm_help_text?: string;
}

interface PromptVariant {
  label: string;
  instruction: string;
}

interface VariantResult {
  variant: PromptVariant;
  playlists: ProposedPlaylist[];
  coverage_pct: number;
  matched: number;
  total: number;
  multi_assigned: number;
  prompt_tokens: number;
  output_tokens: number;
  cost_usd: number;
}

// Claude Sonnet 4.6 pricing per 1M tokens
const COST_PER_M_INPUT = 3.0;
const COST_PER_M_OUTPUT = 15.0;

const SEGMENTATION_RANGES: Record<string, string> = {
  coarse: "entre 2 et 4",
  medium: "entre 3 et 6",
  fine:   "entre 5 et 8",
};

function buildVariants(range: string): PromptVariant[] {
  const catalogRule = `Pour genres_include, utilise exclusivement des genres présents dans le CATALOGUE. Une track peut appartenir à plusieurs playlists.`;
  return [
    {
      label: "Genre-based",
      instruction: `Regroupe les tracks par genre musical dominant. Propose ${range} playlists couvrant les familles de genres les plus représentées dans le catalogue. ${catalogRule}`,
    },
    {
      label: "Energy-based",
      instruction: `Regroupe les tracks par niveau d'énergie et de tempo en t'appuyant sur les valeurs energy/valence. Propose ${range} playlists ordonnées par intensité (calme → énergique). ${catalogRule}`,
    },
    {
      label: "Mood-based",
      instruction: `Regroupe les tracks par mood et valence émotionnelle. Propose ${range} playlists distinctes par feeling. ${catalogRule}`,
    },
    {
      label: "Listening-moment",
      instruction: `Regroupe les tracks par moment d'écoute (concentration, soirée, voyage, sport, fête). Propose ${range} playlists orientées usage. ${catalogRule}`,
    },
    {
      label: "Subculture",
      instruction: `Regroupe les tracks par scène ou sous-culture musicale visible dans le catalogue. Propose ${range} playlists avec une identité forte. ${catalogRule}`,
    },
    {
      label: "Artist-cluster",
      instruction: `Identifie des clusters d'artistes au style similaire à partir des tracks et de leurs genres. Propose ${range} playlists par cluster d'influence. ${catalogRule}`,
    },
    {
      label: "Coverage-maximized",
      instruction: `Identifie les familles de genres qui couvrent le plus de tracks. Propose ${range} playlists en maximisant la couverture totale — les chevauchements sont autorisés et bienvenus. ${catalogRule}`,
    },
    {
      label: "Hybrid-comprehensive",
      instruction: `Analyse les genres du catalogue, l'énergie, le mood et les moments d'écoute. Propose ${range} playlists polyvalentes. Les chevauchements entre playlists sont autorisés : une track de soul électronique peut apparaître dans une playlist Soul ET dans une playlist Électro. ${catalogRule}`,
    },
  ];
}

function buildGenreCatalog(tracks: TrackRow[]): string {
  const counts: Record<string, number> = {};
  for (const t of tracks) {
    for (const g of t.genres ?? []) {
      counts[g] = (counts[g] ?? 0) + 1;
    }
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([g, n]) => `${g} (${n})`)
    .join(", ");
}

function buildPrompt(variant: PromptVariant, tracks: TrackRow[]): string {
  const sample = tracks.map((t) => ({
    name: t.name,
    artist: t.artists?.[0] ?? "",
    genres: t.genres ?? [],
    energy: t.audio_features?.energy ?? null,
    valence: t.audio_features?.valence ?? null,
  }));

  const genreCatalog = buildGenreCatalog(tracks);

  return `Tu es un expert en organisation musicale.

CATALOGUE DE GENRES (genres présents dans la bibliothèque, par fréquence décroissante) :
${genreCatalog}

TRACKS DE LA BIBLIOTHÈQUE (${sample.length} tracks) :
${JSON.stringify(sample)}

MISSION : ${variant.instruction}

Pour chaque playlist, génère :
- name : nom court en français (2-4 mots max)
- description : une phrase user-facing décrivant le vibe
- llm_help_text : texte de guidage pour le classifier automatique (concret, cas limites, exemples d'artistes)
- genres_include : genres tirés du CATALOGUE CI-DESSUS qui définissent cette playlist (3-10 genres)
- genres_exclude : genres du catalogue à exclure pour éviter les chevauchements (0-4)
- example_artists : 4-6 artistes présents dans les tracks

Réponds UNIQUEMENT avec un JSON valide, sans markdown :
{"playlists": [...]}`;
}

function stripMarkdown(raw: string): string {
  // Strip ```json ... ``` or ``` ... ``` wrappers
  return raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
}

function computeCoverage(
  tracks: TrackRow[],
  playlists: ProposedPlaylist[]
): { matched: number; total: number; pct: number; multi_assigned: number } {
  const total = tracks.length;
  const covered = new Set<number>();
  let multiAssigned = 0;
  tracks.forEach((t, i) => {
    const matchCount = playlists.filter((pl) => {
      const include = (pl.genres_include ?? []).map((g) => g.toLowerCase());
      return (t.genres ?? []).some((g) => include.includes(g.toLowerCase()));
    }).length;
    if (matchCount > 0) covered.add(i);
    if (matchCount > 1) multiAssigned++;
  });
  const matched = covered.size;
  const pct = total > 0 ? Math.round((matched / total) * 100) : 0;
  return { matched, total, pct, multi_assigned: multiAssigned };
}

function printAllResults(results: VariantResult[]) {
  const sorted = [...results].sort((a, b) => b.coverage_pct - a.coverage_pct);
  for (const r of sorted) {
    console.log(`\n┌─ ${r.variant.label.toUpperCase()} — ${r.coverage_pct}% (${r.matched}/${r.total}) · ${r.playlists.length} playlists · ${r.multi_assigned} multi-assignées · $${r.cost_usd.toFixed(4)}`);
    for (const p of r.playlists) {
      const genres = (p.genres_include ?? []).join(", ");
      console.log(`│  • ${p.name.padEnd(28)} [${genres}]`);
    }
    console.log("└" + "─".repeat(70));
  }
}

async function main() {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : null;
  };

  const userId = get("--user-id");
  if (!userId) {
    console.error("Usage: npx tsx scripts/optimize-taxonomy-prompt.ts --user-id <uuid> [--segmentation fine|medium|coarse] [--variants N] [--sample N]");
    process.exit(1);
  }

  const segmentation = get("--segmentation") ?? "medium";
  const range = SEGMENTATION_RANGES[segmentation] ?? SEGMENTATION_RANGES.medium;
  const maxVariants = parseInt(get("--variants") ?? "8", 10);
  const sampleSize = parseInt(get("--sample") ?? "200", 10);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: tracks, error: tracksError } = await supabase
    .from("tracks")
    .select("name, artists, genres, audio_features")
    .eq("user_id", userId)
    .not("enriched_at", "is", null)
    .limit(sampleSize);

  if (tracksError || !tracks) {
    console.error("Erreur fetch tracks:", tracksError?.message);
    process.exit(1);
  }

  const genreCatalog = buildGenreCatalog(tracks as TrackRow[]);
  console.log(`\n${tracks.length} tracks enrichies — segmentation : ${segmentation} (${range} playlists)`);
  console.log(`\nCatalogue de genres :\n${genreCatalog}\n`);

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const variants = buildVariants(range).slice(0, maxVariants);
  const results: VariantResult[] = [];

  for (let i = 0; i < variants.length; i++) {
    const v = variants[i];
    console.log(`[${i + 1}/${variants.length}] ${v.label}…`);

    try {
      const msg = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 3000,
        messages: [{ role: "user", content: buildPrompt(v, tracks as TrackRow[]) }],
      });

      const raw = msg.content[0].type === "text" ? stripMarkdown(msg.content[0].text.trim()) : "";
      const parsed = JSON.parse(raw) as { playlists: ProposedPlaylist[] };
      const playlists = parsed.playlists;

      const { matched, total, pct, multi_assigned } = computeCoverage(tracks as TrackRow[], playlists);
      const inputTokens = msg.usage.input_tokens;
      const outputTokens = msg.usage.output_tokens;
      const cost = (inputTokens / 1_000_000) * COST_PER_M_INPUT + (outputTokens / 1_000_000) * COST_PER_M_OUTPUT;

      results.push({ variant: v, playlists, coverage_pct: pct, matched, total, multi_assigned, prompt_tokens: inputTokens, output_tokens: outputTokens, cost_usd: cost });
      console.log(`   → ${playlists.length} playlists · ${pct}% couverture · ${multi_assigned} multi-assignées · $${cost.toFixed(4)}`);
    } catch (e) {
      console.error(`   ✗ Erreur: ${e}`);
    }

    if (i < variants.length - 1) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  // Affichage complet
  console.log("\n\n══════════════════════════════════════════════════════════════════════");
  console.log("RÉSULTATS COMPLETS — toutes les playlists par variante");
  console.log("══════════════════════════════════════════════════════════════════════");
  printAllResults(results);

  // Classement
  const sorted = [...results].sort((a, b) => b.coverage_pct - a.coverage_pct);
  console.log("\n══════════════════════════════════════");
  console.log("CLASSEMENT PAR COUVERTURE");
  console.log("══════════════════════════════════════");
  sorted.forEach((r, i) => {
    console.log(`${i + 1}. ${r.variant.label.padEnd(25)} ${String(r.coverage_pct).padStart(3)}%  (${r.matched}/${r.total})  ${r.playlists.length} playlists  ${String(r.multi_assigned).padStart(3)} multi  $${r.cost_usd.toFixed(4)}`);
  });

  const winner = sorted[0];
  if (!winner) return;
  console.log("\n══════════════════════════════════════");
  console.log(`PROMPT GAGNANT : ${winner.variant.label}`);
  console.log("══════════════════════════════════════");
  console.log("\nInstruction :");
  console.log(winner.variant.instruction);
  console.log("\nCopier l'instruction dans lib/onboarding/prompts/taxonomy.ts");
}

main().catch((e) => { console.error(e); process.exit(1); });
