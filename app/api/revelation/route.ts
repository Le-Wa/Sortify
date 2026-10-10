import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revelationState } from "@/lib/revelation";

/** État de la Révélation (import → analyse → proposition → création). Idempotent, appelé en boucle. */
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.spotifyId) return Response.json({ error: "Non connecté" }, { status: 401 });
  const retry = new URL(req.url).searchParams.get("retry") === "1";
  try {
    return Response.json(await revelationState(session.spotifyId, retry));
  } catch (error) {
    console.error("État de la Révélation :", error);
    return Response.json({ error: error instanceof Error ? error.message : "Erreur inconnue" }, { status: 500 });
  }
}
