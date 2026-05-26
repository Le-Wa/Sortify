import { z } from "zod";
import type { PlaylistRules } from "@/lib/types";

const FeatureRange = z.object({ min: z.number(), max: z.number() });

export const PlaylistRulesSchema = z.object({
  genres: z.object({
    include: z.array(z.string()),
    exclude: z.array(z.string()),
  }),
  audio_features: z
    .record(
      z.enum(["energy", "danceability", "valence", "tempo", "acousticness"]),
      FeatureRange
    )
    .default({}),
  hard_constraints: z.object({
    max_age_days: z.number().nullable(),
    require_genre_signal: z.boolean(),
  }),
});

export function isValidRules(r: unknown): r is PlaylistRules {
  return PlaylistRulesSchema.safeParse(r).success;
}
