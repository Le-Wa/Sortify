import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/client";

const DEEZER = "https://api.deezer.com";
const LASTFM = "https://ws.audioscrobbler.com/2.0";
const MB = "https://musicbrainz.org/ws/2";
const MB_UA = "Sortify/1.0 (contact@sortify.app)";
const RECCO = "https://api.reccobeats.com/v1";

type GenreResult = { genres: string[]; status: "ok" | "empty" | "error"; raw: unknown };
type ReccoResult = { energy: number | null; danceability: number | null; tempo: number | null; status: "ok" | "empty" | "error" };

async function deezerDebug(isrc: string | undefined): Promise<GenreResult> {
  if (!isrc) return { genres: [], status: "empty", raw: null };
  try {
    const trackRes = await fetch(`${DEEZER}/track/isrc:${isrc}`);
    if (!trackRes.ok) return { genres: [], status: "error", raw: { http: trackRes.status } };
    const track = await trackRes.json() as { error?: unknown; id?: number; album?: { id?: number } };
    if (track.error || !track.album?.id) return { genres: [], status: "empty", raw: track };

    const albumRes = await fetch(`${DEEZER}/album/${track.album.id}`);
    if (!albumRes.ok) return { genres: [], status: "error", raw: { http: albumRes.status } };
    const album = await albumRes.json() as { error?: unknown; genres?: { data: { name: string }[] } };
    if (album.error) return { genres: [], status: "error", raw: { track, album } };

    const genres = album.genres?.data.map((g) => g.name) ?? [];
    return {
      genres,
      status: genres.length > 0 ? "ok" : "empty",
      raw: { track_id: track.id, album_id: track.album.id, genres: album.genres?.data },
    };
  } catch (e) {
    return { genres: [], status: "error", raw: { error: String(e) } };
  }
}

async function lastfmTrackDebug(artist: string, title: string): Promise<GenreResult> {
  const key = process.env.LASTFM_API_KEY;
  if (!key || !artist || !title) return { genres: [], status: "empty", raw: null };
  try {
    const url = `${LASTFM}/?method=track.getTopTags&artist=${encodeURIComponent(artist)}&track=${encodeURIComponent(title)}&api_key=${key}&format=json`;
    const res = await fetch(url);
    if (!res.ok) return { genres: [], status: "error", raw: { http: res.status } };
    const data = await res.json() as { error?: number; toptags?: { tag?: { name: string; count: number }[] } };
    if (data.error || !data.toptags?.tag) return { genres: [], status: "empty", raw: data };
    const genres = data.toptags.tag.sort((a, b) => b.count - a.count).slice(0, 5).map((t) => t.name);
    return { genres, status: genres.length > 0 ? "ok" : "empty", raw: data.toptags };
  } catch (e) {
    return { genres: [], status: "error", raw: { error: String(e) } };
  }
}

async function lastfmArtistDebug(artist: string): Promise<GenreResult> {
  const key = process.env.LASTFM_API_KEY;
  if (!key || !artist) return { genres: [], status: "empty", raw: null };
  try {
    const url = `${LASTFM}/?method=artist.getTopTags&artist=${encodeURIComponent(artist)}&api_key=${key}&format=json`;
    const res = await fetch(url);
    if (!res.ok) return { genres: [], status: "error", raw: { http: res.status } };
    const data = await res.json() as { error?: number; toptags?: { tag?: { name: string; count: number }[] } };
    if (data.error || !data.toptags?.tag) return { genres: [], status: "empty", raw: data };
    const genres = data.toptags.tag.sort((a, b) => b.count - a.count).slice(0, 5).map((t) => t.name);
    return { genres, status: genres.length > 0 ? "ok" : "empty", raw: data.toptags };
  } catch (e) {
    return { genres: [], status: "error", raw: { error: String(e) } };
  }
}

async function musicbrainzDebug(isrc: string | undefined): Promise<GenreResult> {
  if (!isrc) return { genres: [], status: "empty", raw: null };
  const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
  try {
    await sleep(1000);
    const isrcRes = await fetch(`${MB}/isrc/${encodeURIComponent(isrc)}?fmt=json`, {
      headers: { "User-Agent": MB_UA },
    });
    if (!isrcRes.ok) return { genres: [], status: "error", raw: { http: isrcRes.status } };
    const isrcData = await isrcRes.json() as { recordings?: { id: string }[] };
    const mbid = isrcData.recordings?.[0]?.id;
    if (!mbid) return { genres: [], status: "empty", raw: isrcData };

    await sleep(1000);
    const recRes = await fetch(`${MB}/recording/${mbid}?inc=genres+tags&fmt=json`, {
      headers: { "User-Agent": MB_UA },
    });
    if (!recRes.ok) return { genres: [], status: "error", raw: { http: recRes.status } };
    const recording = await recRes.json() as { genres?: { name: string }[]; tags?: { name: string }[] };
    const fromGenres = recording.genres?.map((g) => g.name) ?? [];
    const fromTags = recording.tags?.map((t) => t.name) ?? [];
    const genres = [...new Set([...fromGenres, ...fromTags])];
    return {
      genres,
      status: genres.length > 0 ? "ok" : "empty",
      raw: { mbid, genres: recording.genres, tags: recording.tags },
    };
  } catch (e) {
    return { genres: [], status: "error", raw: { error: String(e) } };
  }
}

async function reccobeatsDebug(isrc: string | undefined): Promise<ReccoResult> {
  if (!isrc) return { energy: null, danceability: null, tempo: null, status: "empty" };
  try {
    const res = await fetch(`${RECCO}/audio-features?ids=${encodeURIComponent(isrc)}`);
    if (!res.ok) return { energy: null, danceability: null, tempo: null, status: "error" };
    const data = await res.json() as { content?: { energy?: number; danceability?: number; tempo?: number }[] };
    const f = data.content?.[0];
    if (!f || f.energy == null || f.danceability == null || f.tempo == null) {
      return { energy: null, danceability: null, tempo: null, status: "empty" };
    }
    return { energy: f.energy, danceability: f.danceability, tempo: f.tempo, status: "ok" };
  } catch (e) {
    return { energy: null, danceability: null, tempo: null, status: "error" };
  }
}

export async function GET(req: NextRequest) {
  const trackId = req.nextUrl.searchParams.get("track_id");
  if (!trackId) return NextResponse.json({ error: "Missing track_id" }, { status: 400 });

  const supabase = createClient();
  const { data: row, error } = await supabase
    .from("tracks")
    .select("spotify_track_id, name, artist_name, artists, isrc, spotify_added_at")
    .eq("spotify_track_id", trackId)
    .limit(1)
    .single();

  if (error || !row) return NextResponse.json({ error: "Track not found" }, { status: 404 });

  const isrc = (row.isrc as string | null) ?? undefined;
  const artist = (row.artist_name as string | null) ?? ((row.artists as string[] | null)?.[0] ?? "");
  const title = (row.name as string | null) ?? "";

  // Call all sources in parallel — MusicBrainz adds ~2s due to rate-limit sleeps
  const [deezer, lastfmTrack, lastfmArtist, musicbrainz, reccobeats] = await Promise.all([
    deezerDebug(isrc),
    lastfmTrackDebug(artist, title),
    lastfmArtistDebug(artist),
    musicbrainzDebug(isrc),
    reccobeatsDebug(isrc),
  ]);

  // Replicate the waterfall logic from enrichTrack to determine final_genres + source
  const dedup = (g: string[]) => [...new Set(g.map((s) => s.toLowerCase()))];
  let finalGenres: string[] = [];
  let enrichmentSource: "deezer" | "lastfm_track" | "lastfm_artist" | "musicbrainz" | "none" = "none";

  if (deezer.genres.length > 0) {
    finalGenres = dedup(deezer.genres);
    enrichmentSource = "deezer";
  } else if (lastfmTrack.genres.length > 0) {
    finalGenres = dedup(lastfmTrack.genres);
    enrichmentSource = "lastfm_track";
  } else if (lastfmArtist.genres.length > 0) {
    finalGenres = dedup(lastfmArtist.genres);
    enrichmentSource = "lastfm_artist";
  } else if (musicbrainz.genres.length > 0) {
    finalGenres = dedup(musicbrainz.genres);
    enrichmentSource = "musicbrainz";
  }

  return NextResponse.json({
    track: { name: title, artist, isrc: isrc ?? null },
    results: {
      deezer: { genres: deezer.genres, status: deezer.status, raw: deezer.raw },
      lastfm_track: { genres: lastfmTrack.genres, status: lastfmTrack.status, raw: lastfmTrack.raw },
      lastfm_artist: { genres: lastfmArtist.genres, status: lastfmArtist.status, raw: lastfmArtist.raw },
      musicbrainz: { genres: musicbrainz.genres, status: musicbrainz.status, raw: musicbrainz.raw },
      reccobeats: reccobeats,
    },
    final_genres: finalGenres,
    enrichment_source: enrichmentSource,
  });
}
