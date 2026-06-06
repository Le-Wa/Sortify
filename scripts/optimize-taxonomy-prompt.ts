#!/usr/bin/env node
/**
 * Optimize the taxonomy prompt by testing multiple variants against a user's enriched tracks.
 *
 * Usage:
 *   npx tsx scripts/optimize-taxonomy-prompt.ts --user-id <db-user-id>
 *
 * Options:
 *   --user-id <id>        Supabase user UUID (required)
 *   --target-count <n>    Test with exactly N playlists (default: all variants use their own count)
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
  prompt_tokens: number;
  output_tokens: number;
  cost_usd: number;
}

// Claude Sonnet 4.6 pricing (approximate, per 1M tokens)
const COST_PER_M_INPUT = 3.0;
const COST_PER_M_OUTPUT = 15.0;

function buildVariants(targetCount: number | null): PromptVariant[] {
  const n = targetCount ?? 4;
  return [
    {
      label: "Genre-based",
      instruction: `Regroupe les tracks par genre musical dominant. Propose exactement ${n} playlists couvrant les genres les plus représentés dans la bibliothèque.`,
    },
    {
      label: "Energy-based",
      instruction: `Regroupe les tracks par niveau d'énergie et de tempo (calme, medium, énergique). Propose exactement ${n} playlists ordonnées par intensité.`,
    },
    {
      label: "Mood-based",
      instruction: `Regroupe les tracks par mood et valence émotionnelle (mélancolique, neutre, positif). Propose exactement ${n} playlists distinctes par feeling.`,
    },
    {
      label: "Listening-moment",
      instruction: `Regroupe les tracks par moment d'écoute (matin, concentration, soirée, fête, sport). Propose exactement ${n} playlists orientées usage.`,
    },
    {
      label: "Subculture",
      instruction: `Regroupe les tracks par sous-culture ou scène musicale (underground, mainstream, indie, classique, électro, etc). Propose exactement ${n} playlists avec une identité forte.`,
    },
    {
      label: "Artist-cluster",
      instruction: `Identifie les clusters d'artistes qui ont des styles similaires et regroupe les tracks autour d'eux. Propose exactement ${n} playlists basées sur ces clusters d'influence.`,
    },
    {
      label: "Diversity-maximized",
      instruction: `Propose exactement ${n} playlists en maximisant la diversité des styles couverts. Assure-toi que chaque playlist a un périmètre clairement distinct et que la couverture globale est maximale.`,
    },
    {
      label: "Hybrid-comprehensive",
      instruction: `Analyse les genres, l'énergie, le mood et les moments d'écoute. Propose exactement ${n} playlists polyvalentes qui couvrent le maximum de la bibliothèque sans chevauchements. Pour chaque playlist, définis des genres_include précis.`,
    },
  ];
}

function buildPrompt(variant: PromptVariant, tracks: TrackRow[], n: number): string {
  const sample = tracks.slice(0, 200).map((t) => ({
    name: t.name,
    artist: t.artists?.[0] ?? "",
    genres: t.genres ?? [],
    energy: t.audio_features?.energy ?? null,
    valence: t.audio_features?.valence ?? null,
  }));

  return `Tu es un expert en organisation musicale. Voici un échantillon de ${sample.length} tracks d'un utilisateur Spotify :

${JSON.stringify(sample)}

${variant.instruction}

Pour chaque playlist, génère :
- name : nom court en français (2-4 mots max)
- description : une phrase user-facing décrivant le vibe
- llm_help_text : texte de guidage pour le classifier automatique (concrèt, avec cas limites et exemples)
- genres_include : liste de genres musicaux cibles (3-8 genres)
- genres_exclude : liste de genres à exclure (0-3)
- example_artists : 4-6 artistes présents dans les tracks

Réponds UNIQUEMENT avec un JSON valide, sans markdown :
{"playlists": [...]}`;
}

function computeCoverage(
  tracks: TrackRow[],
  playlists: ProposedPlaylist[]
): { matched: number; total: number; pct: number } {
  const total = tracks.length;
  const covered = new Set<number>();
  for (const pl of playlists) {
    const include = (pl.genres_include ?? []).map((g) => g.toLowerCase());
    tracks.forEach((t, i) => {
      if ((t.genres ?? []).some((g) => include.includes(g.toLowerCase()))) {
        covered.add(i);
      }
    });
  }
  const matched = covered.size;
  const pct = total > 0 ? Math.round((matched / total) * 100) : 0;
  return { matched, total, pct };
}

async function main() {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : null;
  };

  const userId = get("--user-id");
  if (!userId) {
    console.error("Usage: npx tsx scripts/optimize-taxonomy-prompt.ts --user-id <uuid>");
    process.exit(1);
  }

  const targetCountArg = get("--target-count");
  const targetCount = targetCountArg ? parseInt(targetCountArg, 10) : null;
  const maxVariants = parseInt(get("--variants") ?? "8", 10);
  const sampleSize = parseInt(get("--sample") ?? "200", 10);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(supabaseUrl, supabaseKey);

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

  console.log(`\n${tracks.length} tracks enrichies chargées pour user ${userId}`);
  console.log(`Test de ${Math.min(maxVariants, 8)} variantes de prompt\n`);

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const variants = buildVariants(targetCount).slice(0, maxVariants);
  const results: VariantResult[] = [];

  for (let i = 0; i < variants.length; i++) {
    const v = variants[i];
    const n = targetCount ?? 4;
    console.log(`[${i + 1}/${variants.length}] ${v.label}…`);

    try {
      const msg = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 3000,
        messages: [{ role: "user", content: buildPrompt(v, tracks as TrackRow[], n) }],
      });

      const raw = msg.content[0].type === "text" ? msg.content[0].text.trim() : "";
      const parsed = JSON.parse(raw) as { playlists: ProposedPlaylist[] };
      const playlists = parsed.playlists;

      const { matched, total, pct } = computeCoverage(tracks as TrackRow[], playlists);
      const inputTokens = msg.usage.input_tokens;
      const outputTokens = msg.usage.output_tokens;
      const cost = (inputTokens / 1_000_000) * COST_PER_M_INPUT + (outputTokens / 1_000_000) * COST_PER_M_OUTPUT;

      results.push({ variant: v, playlists, coverage_pct: pct, matched, total, prompt_tokens: inputTokens, output_tokens: outputTokens, cost_usd: cost });
      console.log(`   → ${playlists.length} playlists · ${pct}% couverture · $${cost.toFixed(4)}`);
    } catch (e) {
      console.error(`   ✗ Erreur: ${e}`);
    }

    if (i < variants.length - 1) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  // Classement par couverture
  results.sort((a, b) => b.coverage_pct - a.coverage_pct);

  console.log("\n══════════════════════════════════════");
  console.log("CLASSEMENT PAR COUVERTURE");
  console.log("══════════════════════════════════════");
  results.forEach((r, i) => {
    console.log(`${i + 1}. ${r.variant.label.padEnd(25)} ${String(r.coverage_pct).padStart(3)}%  (${r.matched}/${r.total} tracks)  $${r.cost_usd.toFixed(4)}`);
  });

  const winner = results[0];
  if (!winner) { console.log("\nAucun résultat."); return; }

  console.log("\n══════════════════════════════════════");
  console.log(`PROMPT GAGNANT : ${winner.variant.label}`);
  console.log("══════════════════════════════════════");
  console.log("\nInstruction :");
  console.log(winner.variant.instruction);
  console.log("\nPlaylists proposées :");
  winner.playlists.forEach((p) => {
    console.log(`  - ${p.name} [${(p.genres_include ?? []).join(", ")}]`);
  });
  console.log(`\nCouverture : ${winner.coverage_pct}% (${winner.matched}/${winner.total} tracks)`);
  console.log("\nCopier l'instruction dans lib/onboarding/prompts/taxonomy.ts");
}

main().catch((e) => { console.error(e); process.exit(1); });
