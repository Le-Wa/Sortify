import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getUserBySpotifyId } from "@/lib/supabase/queries";
import { createClient } from "@/lib/supabase/client";

export async function POST(): Promise<Response> {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await getUserBySpotifyId(session.userId);
  if (!dbUser) return Response.json({ error: "User not found" }, { status: 404 });

  const supabase = createClient();
  const { data, error } = await supabase
    .from("tracks")
    .update({ classified_at: null, needs_review: false })
    .eq("user_id", dbUser.id)
    .eq("needs_review", true)
    .eq("is_archived", false)
    .select("id");

  if (error) return Response.json({ error: error.message }, { status: 500 });

  return Response.json({ reset: data?.length ?? 0 });
}
