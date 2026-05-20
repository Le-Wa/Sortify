import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getUserBySpotifyId, unarchiveTrack } from "@/lib/supabase/queries";

type Params = Promise<{ track_id: string }>;

export async function PATCH(
  req: Request,
  { params }: { params: Params }
): Promise<Response> {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await getUserBySpotifyId(session.userId);
  if (!dbUser) return Response.json({ error: "User not found" }, { status: 404 });

  const { track_id } = await params;
  const body = (await req.json()) as { action?: string };

  if (body.action !== "unarchive") {
    return Response.json({ error: "Invalid action" }, { status: 400 });
  }

  await unarchiveTrack(track_id, dbUser.id);
  return Response.json({ success: true });
}
