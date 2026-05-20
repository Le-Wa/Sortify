import type { SavedTrackItem } from "@/lib/spotify/fetchers";
import { getDeezerGenres } from "./deezer";
import { getTrackTags, getArtistTags } from "./lastfm";
import { getMusicBrainzGenres } from "./musicbrainz";
import { getAudioFeatures } from "./reccobeats";
import type { AudioFeatures } from "./reccobeats";

export type { AudioFeatures };

export interface EnrichedData {
  genres: string[];
  audioFeatures: AudioFeatures | null;
}

function dedupLower(genres: string[]): string[] {
  return [...new Set(genres.map((g) => g.toLowerCase()))];
}

export async function resolveGenres(
  isrc: string | undefined,
  artist: string,
  title: string
): Promise<string[]> {
  const deezerGenres = await getDeezerGenres(isrc);
  if (deezerGenres.length > 0) return dedupLower(deezerGenres);

  const trackTags = await getTrackTags(artist, title);
  if (trackTags.length > 0) return dedupLower(trackTags);

  const artistTags = await getArtistTags(artist);
  if (artistTags.length > 0) return dedupLower(artistTags);

  return dedupLower(await getMusicBrainzGenres(isrc));
}

export async function enrichTrack(track: SavedTrackItem): Promise<EnrichedData> {
  const isrc = track.track.external_ids?.isrc;
  const artist = track.track.artists[0]?.name ?? "";
  const title = track.track.name;

  const audioFeaturesPromise = getAudioFeatures(isrc);

  const genresPromise = (async () => {
    const deezerGenres = await getDeezerGenres(isrc);
    if (deezerGenres.length > 0) return deezerGenres;

    const trackTags = await getTrackTags(artist, title);
    if (trackTags.length > 0) return trackTags;

    const artistTags = await getArtistTags(artist);
    if (artistTags.length > 0) return artistTags;

    return getMusicBrainzGenres(isrc);
  })();

  const [genres, audioFeatures] = await Promise.all([genresPromise, audioFeaturesPromise]);

  return { genres: dedupLower(genres), audioFeatures };
}
