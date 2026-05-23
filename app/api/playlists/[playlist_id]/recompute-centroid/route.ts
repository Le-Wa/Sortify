import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import {
  getUserBySpotifyId,
  getPlaylistDetail,
  getPlaylistAssignedFeatures,
  updatePlaylistCentroid,
} from "@/lib/supabase/queries";
import type { AudioFeatures } from "@/lib/enrichment/reccobeats";
import type { PlaylistCentroid } from "@/lib/types";

type Params = Promise<{ playlist_id: string }>;

const CENTROID_DIMS = ["energy", "danceability", "valence", "acousticness"] as const;

function computeCentroid(features: Partial<AudioFeatures>[]): PlaylistCentroid | null {
  const complete = features.filter(
    (f): f is AudioFeatures =>
      f.energy !== undefined &&
      f.danceability !== undefined &&
      f.valence !== undefined &&
      f.acousticness !== undefined
  );
  if (complete.length === 0) return null;

  const sum = { energy: 0, danceability: 0, valence: 0, acousticness: 0 };
  for (const f of complete) {
    for (const dim of CENTROID_DIMS) sum[dim] += f[dim];
  }
  const n = complete.length;
  return {
    energy: sum.energy / n,
    danceability: sum.danceability / n,
    valence: sum.valence / n,
    acousticness: sum.acousticness / n,
    instrumentalness: 0,
    sample_size: n,
  };
}

export async function POST(
  _req: Request,
  { params }: { params: Params }
): Promise<Response> {
  const session = await getServerSession(authOptions);
  if (!session?.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const dbUser = await getUserBySpotifyId(session.userId);
  if (!dbUser) return Response.json({ error: "User not found" }, { status: 404 });

  const { playlist_id } = await params;

  const playlist = await getPlaylistDetail(playlist_id, dbUser.id);
  if (!playlist) return Response.json({ error: "Playlist not found" }, { status: 404 });

  const rawFeatures = await getPlaylistAssignedFeatures(dbUser.id, playlist_id);
  const nonNull = rawFeatures.filter((f): f is Partial<AudioFeatures> => f !== null);
  const centroid = computeCentroid(nonNull);

  await updatePlaylistCentroid(playlist_id, centroid);

  return Response.json({ centroid, sample_size: centroid?.sample_size ?? 0 });
}
