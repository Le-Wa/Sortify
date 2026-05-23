import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getUserBySpotifyId, reorderPlaylists } from "@/lib/supabase/queries";

export async function POST(req: Request): Promise<Response> {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await getUserBySpotifyId(session.userId);
  if (!dbUser) return Response.json({ error: "User not found" }, { status: 404 });

  const body = (await req.json()) as unknown;
  if (
    !Array.isArray(body) ||
    body.some((item) => typeof item?.id !== "string" || typeof item?.priority !== "number")
  ) {
    return Response.json(
      { error: "Expected array of { id: string; priority: number }" },
      { status: 400 }
    );
  }

  await reorderPlaylists(dbUser.id, body as { id: string; priority: number }[]);
  return Response.json({ ok: true });
}
