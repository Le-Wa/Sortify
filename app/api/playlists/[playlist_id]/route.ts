import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import {
  getUserBySpotifyId,
  updatePlaylist,
  reassignPlaylistTracksToInbox,
  removeFromExtraPlaylists,
  deactivatePlaylist,
  type PlaylistPatchData,
} from "@/lib/supabase/queries";
import { PlaylistRulesSchema } from "@/lib/classifier/rules";

const PatchBody = z.object({
  enabled: z.boolean().optional(),
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  llm_help_text: z.string().nullable().optional(),
  rules: PlaylistRulesSchema.optional(),
  learned_at: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
});

type Params = Promise<{ playlist_id: string }>;

// ── PATCH /api/playlists/[playlist_id] ───────────────────────────────────────

export async function PATCH(
  req: Request,
  { params }: { params: Params }
): Promise<Response> {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await getUserBySpotifyId(session.userId);
  if (!dbUser) return Response.json({ error: "User not found" }, { status: 404 });

  const { playlist_id } = await params;
  const parsed = PatchBody.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: parsed.error.message }, { status: 400 });
  const body = parsed.data;

  const patch: PlaylistPatchData = {};
  if ("enabled" in body) patch.enabled = body.enabled;
  if ("name" in body) patch.name = body.name;
  if ("description" in body) patch.description = body.description ?? null;
  if ("llm_help_text" in body) patch.llm_help_text = body.llm_help_text ?? null;
  if ("rules" in body) patch.rules = body.rules;
  if ("learned_at" in body) patch.learned_at = body.learned_at ?? null;
  if ("color" in body) patch.color = body.color ?? null;

  if (Object.keys(patch).length === 0) {
    return Response.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const updated = await updatePlaylist(playlist_id, dbUser.id, patch);
  if (!updated) return Response.json({ error: "Playlist not found" }, { status: 404 });

  return Response.json(updated);
}

// ── DELETE /api/playlists/[playlist_id] ──────────────────────────────────────

export async function DELETE(
  _req: Request,
  { params }: { params: Params }
): Promise<Response> {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await getUserBySpotifyId(session.userId);
  if (!dbUser) return Response.json({ error: "User not found" }, { status: 404 });

  const { playlist_id } = await params;

  // Tracks d'abord — si ça échoue, la playlist reste active (pas de désactivation orpheline)
  const reassigned = await reassignPlaylistTracksToInbox(playlist_id, dbUser.id);
  await removeFromExtraPlaylists(playlist_id, dbUser.id);
  await deactivatePlaylist(playlist_id, dbUser.id);

  return Response.json({ reassigned });
}
