import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getUserBySpotifyId } from "@/lib/supabase/queries";
import { createClient } from "@/lib/supabase/client";

const Body = z.object({
  track_id: z.string().uuid(),
  correct_playlist_id: z.string().uuid().nullable(),
  notes: z.string().max(500).optional(),
});

export async function POST(req: Request): Promise<Response> {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await getUserBySpotifyId(session.userId);
  if (!dbUser) return Response.json({ error: "User not found" }, { status: 404 });

  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: parsed.error.message }, { status: 400 });

  const { track_id, correct_playlist_id, notes } = parsed.data;
  const supabase = createClient();

  const { error } = await supabase.from("benchmark_labels").upsert({
    user_id: dbUser.id,
    track_id,
    correct_playlist_id,
    notes: notes ?? null,
    labeled_at: new Date().toISOString(),
  });
  if (error) throw error;

  return Response.json({ ok: true });
}

export async function DELETE(req: Request): Promise<Response> {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await getUserBySpotifyId(session.userId);
  if (!dbUser) return Response.json({ error: "User not found" }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const track_id = searchParams.get("track_id");
  if (!track_id) return Response.json({ error: "track_id required" }, { status: 400 });

  const supabase = createClient();
  await supabase.from("benchmark_labels").delete().eq("user_id", dbUser.id).eq("track_id", track_id);

  return Response.json({ ok: true });
}
