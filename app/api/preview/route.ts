import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * Extrait de 30 s d'un titre, via Deezer (l'API Spotify ne fournit plus d'extraits).
 * Les liens Deezer expirent : on les résout au moment de l'écoute.
 */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.spotifyId) return Response.json({ error: "Non connecté" }, { status: 401 });
  const isrc = new URL(req.url).searchParams.get("isrc") ?? "";
  if (!/^[A-Z0-9]{12}$/i.test(isrc)) return Response.json({ error: "ISRC invalide" }, { status: 400 });

  const res = await fetch(`https://api.deezer.com/track/isrc:${isrc}`, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return Response.json({ error: `Deezer HTTP ${res.status}` }, { status: 502 });
  const track = (await res.json()) as { preview?: string; error?: unknown };
  if (track.error || !track.preview) return Response.json({ preview: null });
  return Response.json({ preview: track.preview });
}
