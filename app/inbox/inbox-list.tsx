"use client";

import { useState, useEffect } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface InboxTrack {
  id: string;
  spotify_track_id: string;
  name: string | null;
  artist_name: string | null;
  album_name: string | null;
  isrc: string | null;
  genres: string[];
  enrichment_source: string | null;
  audio_features: { energy?: number; danceability?: number; tempo?: number } | null;
  suggested_playlist: string | null;
  suggested_playlist_spotify_id: string | null;
  confidence: number | null;
  classification_reason: string | null;
  deezer_id: string | null;
}

interface InboxPlaylist {
  id: string;
  spotify_playlist_id: string;
  name: string;
}

interface ApiResponse {
  tracks: InboxTrack[];
  total: number;
  page: number;
  per_page: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const PER_PAGE = 20;

function confidenceBadgeClass(c: number | null): string {
  if (c === null) return "bg-neutral-800 text-neutral-400";
  if (c >= 0.55) return "bg-green-900 text-green-300";
  if (c >= 0.4) return "bg-yellow-900 text-yellow-300";
  return "bg-red-900 text-red-300";
}

function FeatureBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-20 shrink-0 text-neutral-500">{label}</span>
      <div className="h-1.5 flex-1 rounded-full bg-neutral-800">
        <div
          className="h-full rounded-full bg-neutral-400"
          style={{ width: `${Math.round(value * 100)}%` }}
        />
      </div>
      <span className="w-7 text-right text-neutral-500">{Math.round(value * 100)}</span>
    </div>
  );
}

// ── Track card ─────────────────────────────────────────────────────────────────

function TrackCard({
  track,
  playlists,
  isExiting,
  isBusy,
  correctingId,
  isReasonExpanded,
  onSetCorrecting,
  onToggleReason,
  onValidate,
  onCorrect,
  onArchive,
}: {
  track: InboxTrack;
  playlists: InboxPlaylist[];
  isExiting: boolean;
  isBusy: boolean;
  correctingId: string | null;
  isReasonExpanded: boolean;
  onSetCorrecting: (pid: string | null) => void;
  onToggleReason: () => void;
  onValidate: () => void;
  onCorrect: (pid: string) => void;
  onArchive: () => void;
}) {
  const [selectedPlaylist, setSelectedPlaylist] = useState(playlists[0]?.id ?? "");
  const isCorrectingThis = correctingId !== null;

  const af = track.audio_features;
  const hasReason = !!track.classification_reason && track.classification_reason.length > 0;
  const isLongReason = (track.classification_reason?.length ?? 0) > 100;

  return (
    <li
      className={`rounded-xl border border-neutral-800 bg-neutral-900 p-4 transition-all duration-300 ${
        isExiting ? "scale-95 opacity-0" : "scale-100 opacity-100"
      }`}
    >
      {/* Track identity */}
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium leading-tight">
            {track.artist_name && (
              <span className="text-neutral-300">{track.artist_name} — </span>
            )}
            <span>{track.name ?? track.spotify_track_id}</span>
          </p>
          {track.album_name && (
            <p className="mt-0.5 truncate text-xs text-neutral-500">({track.album_name})</p>
          )}
        </div>

        {/* Confidence badge */}
        {track.confidence !== null && (
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${confidenceBadgeClass(track.confidence)}`}
          >
            {Math.round(track.confidence * 100)}%
          </span>
        )}
      </div>

      {/* Genres + source */}
      {track.genres.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          {track.genres.slice(0, 4).map((g) => (
            <span
              key={g}
              className="rounded-md bg-neutral-800 px-2 py-0.5 text-xs text-neutral-300"
            >
              {g}
            </span>
          ))}
          {track.enrichment_source && (
            <span className="rounded-md border border-neutral-700 px-2 py-0.5 text-xs text-neutral-500">
              {track.enrichment_source}
            </span>
          )}
        </div>
      )}

      {/* Audio features */}
      {af && (
        <div className="mb-3 flex flex-col gap-1.5">
          {af.energy !== undefined && <FeatureBar label="Énergie" value={af.energy} />}
          {af.danceability !== undefined && (
            <FeatureBar label="Danceabilité" value={af.danceability} />
          )}
          {af.tempo !== undefined && (
            <div className="flex items-center gap-2 text-xs">
              <span className="w-20 shrink-0 text-neutral-500">Tempo</span>
              <span className="text-neutral-400">{Math.round(af.tempo)} BPM</span>
            </div>
          )}
        </div>
      )}

      {/* Suggested playlist */}
      {track.suggested_playlist && (
        <p className="mb-3 text-xs text-neutral-500">
          Suggéré :{" "}
          <span className="font-medium text-neutral-300">{track.suggested_playlist}</span>
        </p>
      )}

      {/* Classification reason */}
      {hasReason && (
        <div className="mb-3 rounded-lg bg-neutral-800/60 px-3 py-2 text-xs text-neutral-400">
          {isLongReason && !isReasonExpanded ? (
            <>
              <span>{track.classification_reason!.slice(0, 100)}…</span>
              <button
                onClick={onToggleReason}
                className="ml-1 text-neutral-500 underline hover:text-neutral-300"
              >
                voir plus
              </button>
            </>
          ) : (
            <>
              <span>{track.classification_reason}</span>
              {isLongReason && (
                <button
                  onClick={onToggleReason}
                  className="ml-1 text-neutral-500 underline hover:text-neutral-300"
                >
                  voir moins
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* Player */}
      <div className="mb-3">
        {track.deezer_id ? (
          <iframe
            title="deezer-widget"
            src={`https://widget.deezer.com/widget/dark/track/${track.deezer_id}`}
            width="100%"
            height="80"
            frameBorder="0"
            allow="encrypted-media"
            className="rounded-lg"
          />
        ) : (
          <a
            href={`https://open.spotify.com/track/${track.spotify_track_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-700 px-3 py-1.5 text-xs text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-white"
          >
            <span>Ouvrir dans Spotify</span>
            <span className="text-neutral-600">↗</span>
          </a>
        )}
      </div>

      {/* Actions */}
      {!isCorrectingThis ? (
        <div className="flex gap-2">
          <button
            disabled={isBusy || !track.suggested_playlist}
            onClick={onValidate}
            className="flex-1 rounded-lg bg-emerald-700 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isBusy ? "…" : "✓ Valider"}
          </button>
          <button
            disabled={isBusy}
            onClick={() => onSetCorrecting(playlists[0]?.id ?? "")}
            className="flex-1 rounded-lg border border-neutral-700 py-1.5 text-sm font-medium transition-colors hover:bg-neutral-800 disabled:opacity-40"
          >
            ✎ Corriger
          </button>
          <button
            disabled={isBusy}
            onClick={onArchive}
            className="rounded-lg border border-neutral-700 px-3 py-1.5 text-sm transition-colors hover:bg-neutral-800 disabled:opacity-40"
            title="Archiver"
          >
            ⊘
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <select
            value={selectedPlaylist}
            onChange={(e) => setSelectedPlaylist(e.target.value)}
            className="flex-1 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {playlists.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            disabled={isBusy || !selectedPlaylist}
            onClick={() => onCorrect(selectedPlaylist)}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-opacity hover:opacity-80 disabled:opacity-40"
          >
            {isBusy ? "…" : "OK"}
          </button>
          <button
            disabled={isBusy}
            onClick={() => onSetCorrecting(null)}
            className="rounded-lg border border-neutral-700 px-2.5 py-1.5 text-sm transition-colors hover:bg-neutral-800 disabled:opacity-40"
            aria-label="Annuler"
          >
            ↩
          </button>
        </div>
      )}
    </li>
  );
}

// ── Main client component ──────────────────────────────────────────────────────

export default function InboxClient() {
  const [tracks, setTracks] = useState<InboxTrack[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [filterPlaylistId, setFilterPlaylistId] = useState("");
  const [sliderValue, setSliderValue] = useState(1.0);
  const [maxConfidence, setMaxConfidence] = useState(1.0);

  const [playlists, setPlaylists] = useState<InboxPlaylist[]>([]);

  const [correcting, setCorrecting] = useState<Record<string, string | null>>({});
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [exiting, setExiting] = useState<Set<string>>(new Set());
  const [expandedReasons, setExpandedReasons] = useState<Set<string>>(new Set());

  const [batchLoading, setBatchLoading] = useState(false);
  const [batchMessage, setBatchMessage] = useState<string | null>(null);

  // Load playlists once
  useEffect(() => {
    fetch("/api/playlists")
      .then((r) => r.json())
      .then((data: InboxPlaylist[]) => setPlaylists(data))
      .catch(() => {});
  }, []);

  // Fetch / re-fetch on filter change
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setBatchMessage(null);

    const params = buildParams(1, filterPlaylistId, maxConfidence);
    fetch(`/api/inbox?${params}`)
      .then((r) => r.json())
      .then((data: ApiResponse) => {
        if (cancelled) return;
        setTracks(data.tracks);
        setTotal(data.total);
        setCurrentPage(1);
        setHasMore(data.total > data.tracks.length);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [filterPlaylistId, maxConfidence]);

  function buildParams(page: number, pId: string, maxConf: number): URLSearchParams {
    const p = new URLSearchParams({ page: String(page), per_page: String(PER_PAGE) });
    if (pId) p.set("playlist_id", pId);
    if (maxConf < 1.0) p.set("max_confidence", String(maxConf));
    return p;
  }

  function exitTrack(id: string) {
    setExiting((prev) => new Set([...prev, id]));
    setTimeout(() => {
      setTracks((prev) => prev.filter((t) => t.id !== id));
      setTotal((prev) => prev - 1);
      setExiting((prev) => { const n = new Set(prev); n.delete(id); return n; });
    }, 300);
  }

  async function handleAction(
    trackId: string,
    action: "validate" | "correct" | "archive",
    playlistId?: string
  ) {
    setBusy((prev) => new Set([...prev, trackId]));
    try {
      const body: Record<string, string> = { action };
      if (playlistId) body.playlist_id = playlistId;
      const res = await fetch(`/api/inbox/${trackId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      setCorrecting((prev) => { const n = { ...prev }; delete n[trackId]; return n; });
      exitTrack(trackId);
    } catch (err) {
      alert(`Erreur : ${String(err)}`);
    } finally {
      setBusy((prev) => { const n = new Set(prev); n.delete(trackId); return n; });
    }
  }

  async function loadMore() {
    setLoadingMore(true);
    const nextPage = currentPage + 1;
    const params = buildParams(nextPage, filterPlaylistId, maxConfidence);
    try {
      const res = await fetch(`/api/inbox?${params}`);
      const data: ApiResponse = await res.json();
      setTracks((prev) => [...prev, ...data.tracks]);
      setCurrentPage(nextPage);
      setHasMore(data.total > nextPage * data.per_page);
    } catch {
      // keep current state
    } finally {
      setLoadingMore(false);
    }
  }

  async function handleBatchValidate() {
    if (!window.confirm("Valider tous les tracks avec confidence ≥ 55% ?")) return;
    setBatchLoading(true);
    setBatchMessage(null);
    try {
      const res = await fetch("/api/inbox/batch-validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ min_confidence: 0.55 }),
      });
      const data = await res.json() as { validated: number; errors: string[] };
      setBatchMessage(`${data.validated} track${data.validated !== 1 ? "s" : ""} validé${data.validated !== 1 ? "s" : ""}`);
      // Re-fetch to reflect new state
      const params = buildParams(1, filterPlaylistId, maxConfidence);
      const fresh = await fetch(`/api/inbox?${params}`).then((r) => r.json()) as ApiResponse;
      setTracks(fresh.tracks);
      setTotal(fresh.total);
      setCurrentPage(1);
      setHasMore(fresh.total > fresh.tracks.length);
    } catch (err) {
      alert(`Erreur batch : ${String(err)}`);
    } finally {
      setBatchLoading(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-bold">
            {loading ? "Inbox" : `${total} track${total !== 1 ? "s" : ""} à revoir`}
          </h1>
          <button
            onClick={handleBatchValidate}
            disabled={batchLoading || total === 0 || loading}
            className="shrink-0 rounded-lg border border-neutral-700 px-3 py-1.5 text-sm text-neutral-400 transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {batchLoading ? "…" : "Tout valider (+55%)"}
          </button>
        </div>

        {/* Filters */}
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <select
            value={filterPlaylistId}
            onChange={(e) => setFilterPlaylistId(e.target.value)}
            className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-300 focus:outline-none focus:ring-1 focus:ring-neutral-600"
          >
            <option value="">Toutes les playlists</option>
            {playlists.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <div className="flex flex-1 items-center gap-3 text-sm">
            <span className="shrink-0 text-neutral-500">
              Confidence max : {sliderValue < 1.0 ? `${Math.round(sliderValue * 100)}%` : "tous"}
            </span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={sliderValue}
              onChange={(e) => setSliderValue(parseFloat(e.target.value))}
              onMouseUp={(e) => setMaxConfidence(parseFloat((e.target as HTMLInputElement).value))}
              onTouchEnd={(e) => setMaxConfidence(parseFloat((e.target as HTMLInputElement).value))}
              className="flex-1 accent-neutral-400"
            />
          </div>
        </div>

        {batchMessage && (
          <p className="mt-2 text-sm text-green-400">{batchMessage}</p>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex min-h-64 items-center justify-center text-neutral-500">
          Chargement…
        </div>
      ) : tracks.length === 0 ? (
        <div className="flex min-h-64 items-center justify-center text-neutral-500">
          Inbox vide — tout est trié ✓
        </div>
      ) : (
        <>
          <ul className="flex flex-col gap-3">
            {tracks.map((track) => (
              <TrackCard
                key={track.id}
                track={track}
                playlists={playlists}
                isExiting={exiting.has(track.id)}
                isBusy={busy.has(track.id)}
                correctingId={correcting[track.id] ?? null}
                isReasonExpanded={expandedReasons.has(track.id)}
                onSetCorrecting={(pid) =>
                  setCorrecting((prev) =>
                    pid === null
                      ? (({ [track.id]: _, ...rest }) => rest)(prev)
                      : { ...prev, [track.id]: pid }
                  )
                }
                onToggleReason={() =>
                  setExpandedReasons((prev) => {
                    const n = new Set(prev);
                    n.has(track.id) ? n.delete(track.id) : n.add(track.id);
                    return n;
                  })
                }
                onValidate={() => handleAction(track.id, "validate")}
                onCorrect={(pid) => handleAction(track.id, "correct", pid)}
                onArchive={() => handleAction(track.id, "archive")}
              />
            ))}
          </ul>

          {hasMore && (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="mt-6 w-full rounded-lg border border-neutral-700 py-2.5 text-sm text-neutral-400 transition-colors hover:bg-neutral-800 disabled:opacity-40"
            >
              {loadingMore ? "Chargement…" : "Charger plus"}
            </button>
          )}
        </>
      )}
    </main>
  );
}
