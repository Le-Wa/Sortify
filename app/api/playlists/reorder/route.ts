import { z } from "zod";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getUserBySpotifyId, reorderPlaylists } from "@/lib/supabase/queries";

const Body = z.array(z.object({ id: z.string(), priority: z.number() }));

export async function POST(req: Request): Promise<Response> {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: "Expected array of { id: string; priority: number }" },
      { status: 400 }
    );
  }

  const dbUser = await getUserBySpotifyId(session.userId);
  if (!dbUser) return Response.json({ error: "User not found" }, { status: 404 });

  await reorderPlaylists(dbUser.id, parsed.data);
  return Response.json({ ok: true });
}
