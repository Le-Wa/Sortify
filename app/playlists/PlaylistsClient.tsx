"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import type { PlaylistRules } from "@/lib/types";

// ── Types ──────────────────────────────────────────────────────────────────────

interface PlaylistData {
  id: string;
  spotify_playlist_id: string;
  name: string;
  description: string | null;
  priority: number;
  enabled: boolean;
  llm_help_text: string | null;
  learned_at: string | null;
  color: string | null;
  total: number;
  synced: number;
  not_synced: number;
}

interface PreviewData {
  rules: PlaylistRules;
  short_description: string | null;
  llm_help_text: string | null;
  sample_size?: number;
  total_tracks?: number;
}

type ModalState =
  | null
  | { type: "from-desc"; playlistId: string; playlistName: string }
  | { type: "preview"; playlistId: string; playlistName: string; preview: PreviewData }
  | { type: "edit"; playlistId: string; playlistName: string; currentDescription: string | null; currentColor: string | null }
  | { type: "confirm-delete"; playlistId: string; playlistName: string }
  | { type: "new" };

// ── Constants ─────────────────────────────────────────────────────────────────

import { playlistSwatch, SWATCH_COLORS } from "@/lib/playlist-swatch";

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function parseSpotifyId(raw: string): string {
  const m = raw.match(/playlist\/([a-zA-Z0-9]+)/);
  return m ? m[1] : raw.trim();
}

// ── Spotify picker item ───────────────────────────────────────────────────────

interface SpotifyPickerItem {
  id: string;
  name: string;
  tracks_total: number;
  already_linked: boolean;
}

// ── Genre tag colors ──────────────────────────────────────────────────────────

const GENRE_PALETTES = [
  { bg: "var(--sage-light)", color: "var(--sage)", border: "var(--sage-border)" },
  { bg: "var(--amber-light)", color: "var(--amber)", border: "rgba(200,152,64,0.25)" },
  { bg: "var(--terra-light)", color: "var(--terra)", border: "var(--terra-border)" },
  { bg: "rgba(136,120,208,0.12)", color: "#8878d0", border: "rgba(136,120,208,0.22)" },
];

function genrePalette(genre: string) {
  let h = 0;
  for (const c of genre) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return GENRE_PALETTES[h % GENRE_PALETTES.length];
}

// ── Main component ────────────────────────────────────────────────────────────

export default function PlaylistsClient({ playlists: initial }: { playlists: PlaylistData[] }) {

  // Lists
  const [active, setActive] = useState<PlaylistData[]>(() =>
    initial.filter((p) => p.enabled).sort((a, b) => a.priority - b.priority)
  );
  const [inactive, setInactive] = useState<PlaylistData[]>(() =>
    initial.filter((p) => !p.enabled)
  );
  const [inactiveOpen, setInactiveOpen] = useState(false);

  // Per-card loading: id → 'toggle' | 'learn' | 'delete' | 'recompute'
  const [cardLoading, setCardLoading] = useState<Record<string, string>>({});

  // Drag state
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  // Bottom sheet
  const [bottomSheet, setBottomSheet] = useState<string | null>(null);

  // Pointer type — coarse = touch device, disable drag-and-drop
  const [isCoarsePointer, setIsCoarsePointer] = useState(false);
  useEffect(() => {
    setIsCoarsePointer(window.matchMedia("(pointer: coarse)").matches);
  }, []);

  // Sync all loading
  const [syncingAll, setSyncingAll] = useState(false);

  // Toast
  const [toast, setToast] = useState<string | null>(null);

  // Modal
  const [modal, setModal] = useState<ModalState>(null);

  // From-desc modal transient state
  const [fromDescText, setFromDescText] = useState("");
  const [fromDescLoading, setFromDescLoading] = useState(false);
  const [fromDescError, setFromDescError] = useState<string | null>(null);

  // Preview modal transient state
  const [previewHelp, setPreviewHelp] = useState("");
  const [previewShortDesc, setPreviewShortDesc] = useState("");
  const [previewSaving, setPreviewSaving] = useState(false);

  // Edit modal transient state
  const [editDescription, setEditDescription] = useState("");
  const [editColor, setEditColor] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  // New playlist modal transient state
  const [newMode, setNewMode] = useState<"link" | "create">("link");
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newVibe, setNewVibe] = useState("");
  const [newRules, setNewRules] = useState<PlaylistRules | null>(null);
  const [newLoading, setNewLoading] = useState<string | null>(null);
  // Picker state (link mode)
  const [newPickerPlaylists, setNewPickerPlaylists] = useState<SpotifyPickerItem[] | null>(null);
  const [newPickerLoading, setNewPickerLoading] = useState(false);
  const [newPickerError, setNewPickerError] = useState<string | null>(null);
  const [newSelectedId, setNewSelectedId] = useState("");
  const [newManualId, setNewManualId] = useState(""); // fallback when picker fails

  // ── Helpers ───────────────────────────────────────────────────────────────────

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast((t) => (t === msg ? null : t)), 3000);
  }

  function setLoad(id: string, state: string | null) {
    setCardLoading((prev) => {
      const n = { ...prev };
      if (state === null) delete n[id];
      else n[id] = state;
      return n;
    });
  }

  function closeModal() {
    setModal(null);
    setFromDescText("");
    setFromDescLoading(false);
    setFromDescError(null);
    setPreviewHelp("");
    setPreviewSaving(false);
  }

  function resetNew() {
    setNewMode("link"); setNewName(""); setNewDesc(""); setNewVibe(""); setNewRules(null); setNewLoading(null);
    setNewPickerPlaylists(null); setNewPickerLoading(false); setNewPickerError(null);
    setNewSelectedId(""); setNewManualId("");
  }

  // ── Actions ───────────────────────────────────────────────────────────────────

  async function toggle(p: PlaylistData) {
    if (cardLoading[p.id]) return;
    setLoad(p.id, "toggle");
    try {
      const res = await fetch(`/api/playlists/${p.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: !p.enabled }),
      });
      if (!res.ok) throw new Error();
      if (p.enabled) {
        setActive((prev) => prev.filter((x) => x.id !== p.id));
        setInactive((prev) => [{ ...p, enabled: false }, ...prev]);
        setInactiveOpen(true);
      } else {
        setInactive((prev) => prev.filter((x) => x.id !== p.id));
        setActive((prev) => [...prev, { ...p, enabled: true }]);
      }
    } catch {
      showToast("Erreur lors du changement de statut");
    } finally {
      setLoad(p.id, null);
    }
  }

  async function learn(p: PlaylistData) {
    if (cardLoading[p.id]) return;
    setLoad(p.id, "learn");
    try {
      const res = await fetch(`/api/playlists/${p.id}/learn`, { method: "POST" });
      const data = (await res.json()) as { error?: string } & Partial<PreviewData>;
      if (!res.ok || data.error) throw new Error(data.error ?? "");
      setPreviewHelp(data.llm_help_text ?? "");
      setPreviewShortDesc((data as PreviewData).short_description ?? "");
      setModal({ type: "preview", playlistId: p.id, playlistName: p.name, preview: data as PreviewData });
    } catch (err) {
      showToast(err instanceof Error && err.message ? err.message : "Analyse échouée");
    } finally {
      setLoad(p.id, null);
    }
  }

  async function recompute(id: string) {
    setLoad(id, "recompute");
    setBottomSheet(null);
    try {
      const res = await fetch(`/api/playlists/${id}/recompute-centroid`, { method: "POST" });
      if (!res.ok) throw new Error();
      showToast("Centroïde recalculé");
    } catch {
      showToast("Erreur recompute");
    } finally {
      setLoad(id, null);
    }
  }

  async function submitFromDesc(playlistId: string, playlistName: string) {
    if (!fromDescText.trim()) return;
    setFromDescLoading(true);
    setFromDescError(null);
    try {
      const res = await fetch("/api/playlists/from-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: fromDescText.trim() }),
      });
      const data = (await res.json()) as { error?: string } & Partial<PreviewData>;
      if (data.error) throw new Error(data.error);
      if (!res.ok) throw new Error("Génération échouée");
      setPreviewHelp(data.llm_help_text ?? "");
      setPreviewShortDesc((data as PreviewData).short_description ?? "");
      setModal({ type: "preview", playlistId, playlistName, preview: data as PreviewData });
      setFromDescText("");
      setFromDescError(null);
    } catch (err) {
      setFromDescError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setFromDescLoading(false);
    }
  }

  async function savePreview(playlistId: string, preview: PreviewData) {
    setPreviewSaving(true);
    try {
      const res = await fetch(`/api/playlists/${playlistId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rules: preview.rules,
          llm_help_text: previewHelp.trim() || null,
          description: previewShortDesc.trim() || null,
          learned_at: new Date().toISOString(),
        }),
      });
      if (!res.ok) throw new Error();
      const now = new Date().toISOString();
      const shortDesc = previewShortDesc.trim() || null;
      const patch = (list: PlaylistData[]) =>
        list.map((p) =>
          p.id === playlistId
            ? { ...p, llm_help_text: previewHelp.trim() || null, description: shortDesc, learned_at: now }
            : p
        );
      setActive(patch);
      setInactive(patch);
      closeModal();
    } catch {
      showToast("Erreur lors de la sauvegarde");
    } finally {
      setPreviewSaving(false);
    }
  }

  async function saveEdit(playlistId: string) {
    setEditSaving(true);
    try {
      const body: Record<string, unknown> = {
        description: editDescription.trim() || null,
        color: editColor,
      };
      const res = await fetch(`/api/playlists/${playlistId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      const desc = editDescription.trim() || null;
      const patch = (list: PlaylistData[]) =>
        list.map((p) => p.id === playlistId ? { ...p, description: desc, color: editColor } : p);
      setActive(patch);
      setInactive(patch);
      closeModal();
    } catch {
      showToast("Erreur lors de la sauvegarde");
    } finally {
      setEditSaving(false);
    }
  }

  async function confirmDelete(playlistId: string) {
    setLoad(playlistId, "delete");
    try {
      const res = await fetch(`/api/playlists/${playlistId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setInactive((prev) => prev.filter((p) => p.id !== playlistId));
      closeModal();
    } catch {
      showToast("Erreur lors de la suppression");
    } finally {
      setLoad(playlistId, null);
    }
  }

  // Drag handlers (active list, desktop only)
  function onDragStart(id: string) { setDragId(id); }
  function onDragOver(e: React.DragEvent, id: string) { e.preventDefault(); setOverId(id); }
  function onDragEnd() { setDragId(null); setOverId(null); }
  async function onDrop(e: React.DragEvent, targetId: string) {
    e.preventDefault();
    const from = dragId;
    setDragId(null); setOverId(null);
    if (!from || from === targetId) return;

    const prev = [...active];
    const next = [...active];
    const fi = next.findIndex((p) => p.id === from);
    const ti = next.findIndex((p) => p.id === targetId);
    const [item] = next.splice(fi, 1);
    next.splice(ti, 0, item);
    setActive(next);

    try {
      const res = await fetch("/api/playlists/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next.map((p, i) => ({ id: p.id, priority: i }))),
      });
      if (!res.ok) throw new Error();
    } catch {
      setActive(prev);
      showToast("Ordre non sauvegardé");
    }
  }

  // Sync all playlists with pending tracks
  async function syncAll() {
    if (syncingAll) return;
    setSyncingAll(true);
    const toSync = active.filter((p) => p.not_synced > 0);
    try {
      await Promise.all(
        toSync.map(async (p) => {
          try {
            const res = await fetch(`/api/playlists/${p.id}/sync`, { method: "POST" });
            if (!res.ok) return;
            const data = (await res.json()) as { synced: number };
            if (data.synced > 0) {
              setActive((prev) =>
                prev.map((ap) =>
                  ap.id === p.id
                    ? { ...ap, synced: ap.synced + data.synced, not_synced: Math.max(0, ap.not_synced - data.synced) }
                    : ap
                )
              );
            }
          } catch {
            // individual failure — continue
          }
        })
      );
      showToast("Sync terminé");
    } finally {
      setSyncingAll(false);
    }
  }

  // Move up/down — used from bottom sheet (mobile reorder)
  async function moveUp(id: string) {
    const idx = active.findIndex((p) => p.id === id);
    if (idx <= 0) return;
    const prev = [...active];
    const next = [...active];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    setActive(next);
    try {
      const res = await fetch("/api/playlists/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next.map((p, i) => ({ id: p.id, priority: i }))),
      });
      if (!res.ok) throw new Error();
    } catch {
      setActive(prev);
      showToast("Ordre non sauvegardé");
    }
  }

  async function moveDown(id: string) {
    const idx = active.findIndex((p) => p.id === id);
    if (idx < 0 || idx >= active.length - 1) return;
    const prev = [...active];
    const next = [...active];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    setActive(next);
    try {
      const res = await fetch("/api/playlists/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next.map((p, i) => ({ id: p.id, priority: i }))),
      });
      if (!res.ok) throw new Error();
    } catch {
      setActive(prev);
      showToast("Ordre non sauvegardé");
    }
  }

  // New playlist: load Spotify picker
  async function loadPicker() {
    if (newPickerLoading) return;
    setNewPickerLoading(true);
    setNewPickerError(null);
    try {
      const res = await fetch("/api/spotify/my-playlists");
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as SpotifyPickerItem[];
      setNewPickerPlaylists(data);
    } catch (err) {
      setNewPickerError(err instanceof Error ? err.message : "Erreur chargement");
    } finally {
      setNewPickerLoading(false);
    }
  }

  // New playlist: generate vibe rules
  async function generateVibe() {
    if (!newVibe.trim() || newLoading) return;
    setNewLoading("vibe");
    try {
      const res = await fetch("/api/playlists/from-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: newVibe.trim() }),
      });
      const data = (await res.json()) as { error?: string; rules?: PlaylistRules };
      if (data.error) throw new Error(data.error);
      if (!res.ok || !data.rules) throw new Error("Génération échouée");
      setNewRules(data.rules);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Génération échouée");
    } finally {
      setNewLoading(null);
    }
  }

  // New playlist: create
  async function createPlaylist() {
    if (!newName.trim() || newLoading) return;

    let spotifyPlaylistId: string | undefined;
    if (newMode === "link") {
      const raw = newSelectedId || parseSpotifyId(newManualId);
      if (!raw) return;
      spotifyPlaylistId = raw;
    }

    setNewLoading("saving");
    try {
      const body: Record<string, unknown> = { name: newName.trim() };
      if (newDesc.trim()) body.description = newDesc.trim();
      if (newRules) body.rules = newRules;
      if (spotifyPlaylistId) body.spotifyPlaylistId = spotifyPlaylistId;

      const res = await fetch("/api/playlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { id: string; spotify_playlist_id: string };

      setActive((prev) => [
        ...prev,
        {
          id: data.id,
          spotify_playlist_id: data.spotify_playlist_id,
          name: newName.trim(),
          description: newDesc.trim() || null,
          priority: prev.length,
          enabled: true, llm_help_text: null, learned_at: null, color: null,
          total: 0, synced: 0, not_synced: 0,
        },
      ]);
      resetNew();
      closeModal();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Erreur création");
      setNewLoading(null);
    }
  }

  // ── Bottom sheet data ─────────────────────────────────────────────────────────

  const bsPlaylist = bottomSheet
    ? [...active, ...inactive].find((p) => p.id === bottomSheet) ?? null
    : null;
  const bsIdx = bsPlaylist?.enabled ? active.findIndex((p) => p.id === bottomSheet) : -1;

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <>
      <main className="s-page">

        {/* Header */}
        <div className="s-page-header" style={{ marginBottom: 28 }}>
          <div>
            <div style={{ fontSize: 12, color: "var(--ink-dim)", marginBottom: 4 }}>Bibliothèque</div>
            <h1 className="font-fraunces s-page-h1" style={{ fontSize: 36, fontWeight: 600, letterSpacing: "-0.5px", color: "var(--ink)", lineHeight: 1.1 }}>
              {active.length}{" "}
              <em style={{ fontStyle: "italic", color: "var(--terra)" }}>
                playlist{active.length !== 1 ? "s" : ""}
              </em>
            </h1>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            {active.some((p) => p.not_synced > 0) && (
              <button
                className="s-btn"
                onClick={() => void syncAll()}
                disabled={syncingAll}
              >
                {syncingAll ? "Sync…" : `Sync All (${active.reduce((s, p) => s + p.not_synced, 0)})`}
              </button>
            )}
            <button
              className="s-btn s-btn-primary"
              onClick={() => { setModal({ type: "new" }); void loadPicker(); }}
            >
              + Nouvelle
            </button>
          </div>
        </div>

        {/* Active playlists */}
        {active.length === 0 ? (
          <div style={{ textAlign: "center", color: "var(--ink-mid)", fontSize: 13, padding: "48px 0" }}>
            Aucune playlist active
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {active.map((p, i) => (
              <PlaylistRow
                key={p.id}
                p={p}
                swatch={playlistSwatch(p.id, p.color)}
                load={cardLoading[p.id]}
                isDragging={dragId === p.id}
                isOver={overId === p.id && dragId !== p.id}
                draggable={!isCoarsePointer}
                isDesktop={!isCoarsePointer}
                onToggle={() => toggle(p)}
                onLearn={() => learn(p)}
                onFromDesc={() => {
                  setFromDescText(p.llm_help_text ?? "");
                  setFromDescError(null);
                  setModal({ type: "from-desc", playlistId: p.id, playlistName: p.name });
                }}
                onRecompute={() => void recompute(p.id)}
                onRequestDelete={() => setModal({ type: "confirm-delete", playlistId: p.id, playlistName: p.name })}
                onOpenBottomSheet={() => setBottomSheet(p.id)}
                onDragStart={() => onDragStart(p.id)}
                onDragOver={(e) => onDragOver(e, p.id)}
                onDragEnd={onDragEnd}
                onDrop={(e) => onDrop(e, p.id)}
              />
            ))}
          </div>
        )}

        {/* Inactive playlists */}
        {inactive.length > 0 && (
          <div style={{ marginTop: 36 }}>
            <button
              onClick={() => setInactiveOpen((v) => !v)}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: 10, display: "flex", alignItems: "center", gap: 7 }}
            >
              <span style={{ fontSize: 9, color: "var(--ink-dim)", display: "inline-block", transform: inactiveOpen ? "rotate(90deg)" : "none", transition: "transform 0.15s" }}>▶</span>
              <span style={{ fontSize: 12, color: "var(--ink-dim)" }}>
                {inactive.length} playlist{inactive.length !== 1 ? "s" : ""} désactivée{inactive.length !== 1 ? "s" : ""}
              </span>
            </button>
            {inactiveOpen && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {inactive.map((p, i) => (
                  <PlaylistRow
                    key={p.id}
                    p={p}
                    swatch={playlistSwatch(p.id, p.color)}
                    load={cardLoading[p.id]}
                    isDragging={false}
                    isOver={false}
                    draggable={false}
                    isDesktop={!isCoarsePointer}
                    onToggle={() => toggle(p)}
                    onRequestDelete={() => setModal({ type: "confirm-delete", playlistId: p.id, playlistName: p.name })}
                    onOpenBottomSheet={() => setBottomSheet(p.id)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ── From description modal ──────────────────────────────────────────── */}
      {modal?.type === "from-desc" && (
        <div className="s-modal-overlay" onClick={closeModal}>
          <div className="s-modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-fraunces" style={{ fontSize: 18, fontWeight: 600, marginBottom: 4, color: "var(--ink)" }}>
              Décrire la vibe
            </h2>
            <p style={{ fontSize: 12, color: "var(--ink-dim)", marginBottom: 20 }}>{modal.playlistName}</p>
            <textarea
              autoFocus
              className="s-input"
              rows={4}
              style={{ width: "100%", resize: "vertical", lineHeight: 1.6, marginBottom: 8 }}
              placeholder="Ex : Rap français boom-bap des années 2000, pas de trap ni de drill…"
              value={fromDescText}
              onChange={(e) => setFromDescText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey))
                  void submitFromDesc(modal.playlistId, modal.playlistName);
              }}
            />
            {fromDescError && (
              <p style={{ fontSize: 11, color: "var(--terra)", marginBottom: 10 }}>{fromDescError}</p>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
              <button className="s-btn" onClick={closeModal}>Annuler</button>
              <button
                className="s-btn s-btn-primary"
                disabled={fromDescLoading || !fromDescText.trim()}
                onClick={() => void submitFromDesc(modal.playlistId, modal.playlistName)}
              >
                {fromDescLoading ? "Génération…" : "Générer →"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Preview modal ───────────────────────────────────────────────────── */}
      {modal?.type === "preview" && (
        <div className="s-modal-overlay" onClick={closeModal}>
          <div className="s-modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-fraunces" style={{ fontSize: 18, fontWeight: 600, marginBottom: 4, color: "var(--ink)" }}>
              Aperçu des règles
            </h2>
            <p style={{ fontSize: 12, color: "var(--ink-dim)", marginBottom: 20 }}>
              {modal.playlistName}
              {modal.preview.sample_size != null && (
                <> · <span style={{ color: "var(--sage)" }}>{modal.preview.sample_size} tracks</span> analysés
                  {modal.preview.total_tracks != null ? ` / ${modal.preview.total_tracks}` : ""}</>
              )}
            </p>

            <label style={{ fontSize: 11, color: "var(--ink-dim)", display: "block", marginBottom: 6 }}>
              Sous-titre (court)
            </label>
            <input
              className="s-input"
              style={{ width: "100%", marginBottom: 14 }}
              placeholder="Ex : Rap FR boom-bap, flows techniques, énergie haute"
              value={previewShortDesc}
              onChange={(e) => setPreviewShortDesc(e.target.value)}
            />

            <label style={{ fontSize: 11, color: "var(--ink-dim)", display: "block", marginBottom: 6 }}>
              Description vibe LLM — éditable
            </label>
            <textarea
              className="s-input"
              rows={3}
              style={{ width: "100%", resize: "vertical", lineHeight: 1.6, marginBottom: 20 }}
              placeholder="Description de la vibe pour le classifier LLM…"
              value={previewHelp}
              onChange={(e) => setPreviewHelp(e.target.value)}
            />

            <label style={{ fontSize: 11, color: "var(--ink-dim)", display: "block", marginBottom: 6 }}>
              Règles générées — lecture seule
            </label>
            <pre style={{
              background: "var(--surface2)", border: "1px solid var(--border)", borderRadius: 8,
              padding: "12px 14px", fontSize: 10, lineHeight: 1.7, color: "var(--ink-mid)",
              overflow: "auto", maxHeight: 200, marginBottom: 24,
            }}>
              {JSON.stringify(modal.preview.rules, null, 2)}
            </pre>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button className="s-btn" onClick={closeModal} disabled={previewSaving}>Annuler</button>
              <button
                className="s-btn s-btn-primary"
                disabled={previewSaving}
                onClick={() => void savePreview(modal.playlistId, modal.preview)}
              >
                {previewSaving ? "Sauvegarde…" : "Sauvegarder"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit modal (description + color) ────────────────────────────────── */}
      {modal?.type === "edit" && (
        <div className="s-modal-overlay" onClick={closeModal}>
          <div className="s-modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-fraunces" style={{ fontSize: 18, fontWeight: 600, marginBottom: 4, color: "var(--ink)" }}>
              Modifier
            </h2>
            <p style={{ fontSize: 12, color: "var(--ink-dim)", marginBottom: 20 }}>{modal.playlistName}</p>

            <label style={{ fontSize: 11, color: "var(--ink-dim)", display: "block", marginBottom: 6 }}>
              Sous-titre
            </label>
            <input
              className="s-input"
              style={{ width: "100%", marginBottom: 20 }}
              placeholder="Ex : Rap FR boom-bap, flows techniques"
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
            />

            <label style={{ fontSize: 11, color: "var(--ink-dim)", display: "block", marginBottom: 10 }}>
              Couleur
            </label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 24 }}>
              {SWATCH_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setEditColor(editColor === c ? null : c)}
                  style={{
                    width: 32, height: 32, borderRadius: "50%",
                    background: c, border: "none", cursor: "pointer",
                    outline: editColor === c ? `3px solid ${c}` : "3px solid transparent",
                    outlineOffset: 2,
                    opacity: editColor && editColor !== c ? 0.45 : 1,
                    transition: "opacity 0.15s, outline 0.15s",
                  }}
                />
              ))}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button className="s-btn" onClick={closeModal} disabled={editSaving}>Annuler</button>
              <button
                className="s-btn s-btn-primary"
                disabled={editSaving}
                onClick={() => void saveEdit(modal.playlistId)}
              >
                {editSaving ? "Sauvegarde…" : "Sauvegarder"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm delete modal ────────────────────────────────────────────── */}
      {modal?.type === "confirm-delete" && (
        <div className="s-modal-overlay" onClick={closeModal}>
          <div className="s-modal" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
            <h2 className="font-fraunces" style={{ fontSize: 18, fontWeight: 600, marginBottom: 12, color: "var(--ink)" }}>
              Supprimer la playlist ?
            </h2>
            <p style={{ fontSize: 13, color: "var(--ink-mid)", marginBottom: 24, lineHeight: 1.65 }}>
              <strong style={{ color: "var(--ink)" }}>{modal.playlistName}</strong> sera désactivée définitivement.
              Les tracks assignées repasseront en inbox.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button className="s-btn" onClick={closeModal}>Annuler</button>
              <button
                className="s-btn s-btn-danger"
                disabled={cardLoading[modal.playlistId] === "delete"}
                onClick={() => void confirmDelete(modal.playlistId)}
              >
                {cardLoading[modal.playlistId] === "delete" ? "Suppression…" : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── New playlist modal ──────────────────────────────────────────────── */}
      {modal?.type === "new" && (
        <div className="s-modal-overlay" onClick={() => { resetNew(); closeModal(); }}>
          <div className="s-modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-fraunces" style={{ fontSize: 18, fontWeight: 600, marginBottom: 16, color: "var(--ink)" }}>
              Nouvelle playlist
            </h2>

            {/* Mode tabs */}
            <div style={{ display: "flex", gap: 3, marginBottom: 20, background: "var(--surface2)", borderRadius: 8, padding: 3 }}>
              <button
                onClick={() => { setNewMode("link"); if (!newPickerPlaylists && !newPickerLoading) void loadPicker(); }}
                style={{
                  flex: 1, padding: "7px 10px", borderRadius: 6, border: "none",
                  background: newMode === "link" ? "var(--surface)" : "transparent",
                  color: newMode === "link" ? "var(--ink)" : "var(--ink-dim)",
                  fontSize: 12, fontWeight: newMode === "link" ? 600 : 400,
                  cursor: "pointer", transition: "all 0.15s",
                  boxShadow: newMode === "link" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                }}
              >
                Lier une existante
              </button>
              <button
                onClick={() => { setNewMode("create"); setNewSelectedId(""); }}
                style={{
                  flex: 1, padding: "7px 10px", borderRadius: 6, border: "none",
                  background: newMode === "create" ? "var(--surface)" : "transparent",
                  color: newMode === "create" ? "var(--ink)" : "var(--ink-dim)",
                  fontSize: 12, fontWeight: newMode === "create" ? 600 : 400,
                  cursor: "pointer", transition: "all 0.15s",
                  boxShadow: newMode === "create" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                }}
              >
                Créer dans Spotify
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

              {/* ── Link mode: Spotify picker ── */}
              {newMode === "link" && (
                <div>
                  <label style={{ fontSize: 11, color: "var(--ink-dim)", display: "block", marginBottom: 6 }}>
                    Choisir depuis Spotify *
                  </label>

                  {newPickerLoading && (
                    <div style={{ padding: "20px 0", textAlign: "center", fontSize: 12, color: "var(--ink-dim)" }}>
                      Chargement…
                    </div>
                  )}

                  {!newPickerLoading && newPickerError && (
                    <div>
                      <p style={{ fontSize: 11, color: "var(--terra)", marginBottom: 8 }}>
                        Erreur : {newPickerError}
                      </p>
                      <input
                        type="text" className="s-input" style={{ width: "100%" }}
                        value={newManualId}
                        onChange={(e) => setNewManualId(e.target.value)}
                        placeholder="https://open.spotify.com/playlist/… ou ID"
                        autoFocus
                      />
                    </div>
                  )}

                  {!newPickerLoading && newPickerPlaylists && (
                    <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden", maxHeight: 220, overflowY: "auto" }}>
                      {newPickerPlaylists.length === 0 ? (
                        <div style={{ padding: "16px 14px", fontSize: 12, color: "var(--ink-dim)", textAlign: "center" }}>
                          Aucune playlist Spotify trouvée
                        </div>
                      ) : (
                        newPickerPlaylists.map((p, i) => (
                          <button
                            key={p.id}
                            disabled={p.already_linked}
                            onClick={() => {
                              if (p.already_linked) return;
                              setNewSelectedId(p.id);
                              setNewName(p.name);
                            }}
                            style={{
                              display: "flex", alignItems: "center", justifyContent: "space-between",
                              width: "100%", padding: "10px 14px", border: "none",
                              borderBottom: i < newPickerPlaylists.length - 1 ? "1px solid var(--border)" : "none",
                              background: newSelectedId === p.id ? "var(--terra-light)" : "transparent",
                              cursor: p.already_linked ? "default" : "pointer",
                              opacity: p.already_linked ? 0.4 : 1,
                              textAlign: "left",
                              transition: "background 0.1s",
                            }}
                          >
                            <span style={{ fontSize: 13, color: "var(--ink)", fontWeight: newSelectedId === p.id ? 600 : 400, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {p.name}
                              {p.already_linked && (
                                <span style={{ fontSize: 10, color: "var(--ink-dim)", marginLeft: 7, fontWeight: 400 }}>déjà importée</span>
                              )}
                            </span>
                            <span style={{ fontSize: 11, color: "var(--ink-dim)", flexShrink: 0, marginLeft: 12 }}>
                              {p.tracks_total}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── Create mode: info note ── */}
              {newMode === "create" && (
                <p style={{ fontSize: 11, color: "var(--ink-dim)", background: "var(--surface2)", borderRadius: 6, padding: "8px 10px", margin: 0 }}>
                  Une nouvelle playlist privée sera créée dans votre Spotify.
                </p>
              )}

              {/* Common fields */}
              <div>
                <label style={{ fontSize: 11, color: "var(--ink-dim)", display: "block", marginBottom: 5 }}>
                  {newMode === "link" ? "Nom Sortify *" : "Nom *"}
                </label>
                <input
                  type="text"
                  autoFocus={newMode === "create"}
                  className="s-input"
                  style={{ width: "100%" }}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Rap Français, Électro Workout…"
                />
              </div>

              <div>
                <label style={{ fontSize: 11, color: "var(--ink-dim)", display: "block", marginBottom: 5 }}>Description</label>
                <input
                  type="text" className="s-input" style={{ width: "100%" }}
                  value={newDesc} onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Optionnel"
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--ink-dimmer)", fontSize: 10 }}>
                <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
                Générer les règles (optionnel)
                <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
              </div>

              <div>
                <label style={{ fontSize: 11, color: "var(--ink-dim)", display: "block", marginBottom: 5 }}>Décris la vibe</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="text" className="s-input" style={{ flex: 1 }}
                    value={newVibe}
                    onChange={(e) => { setNewVibe(e.target.value); setNewRules(null); }}
                    placeholder="Rap français boom-bap, pas de trap…"
                  />
                  <button
                    className="s-btn"
                    disabled={!newVibe.trim() || newLoading === "vibe"}
                    onClick={() => void generateVibe()}
                    style={{ flexShrink: 0 }}
                  >
                    {newLoading === "vibe" ? "…" : "Générer"}
                  </button>
                </div>
                {newRules && (
                  <p style={{ fontSize: 10, color: "var(--sage)", marginTop: 6 }}>
                    ✓ Règles générées · {newRules.genres.include.length} genre{newRules.genres.include.length !== 1 ? "s" : ""} inclus
                  </p>
                )}
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 24 }}>
              <button className="s-btn" onClick={() => { resetNew(); closeModal(); }}>Annuler</button>
              <button
                className="s-btn s-btn-primary"
                disabled={
                  !newName.trim() ||
                  (newMode === "link" && !newSelectedId && !newManualId.trim()) ||
                  newLoading === "saving"
                }
                onClick={() => void createPlaylist()}
              >
                {newLoading === "saving" ? "Création…" : "Créer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Bottom sheet ────────────────────────────────────────────────────── */}
      {bsPlaylist && (
        <>
          <div className="s-bs-backdrop" onClick={() => setBottomSheet(null)} />
          <div className="s-bs" role="dialog" aria-modal="true" aria-label={`Options — ${bsPlaylist.name}`}>
            <div className="s-bs-handle" />
            <p className="s-bs-title">{bsPlaylist.name}</p>

            {/* Primary actions */}
            {bsPlaylist.enabled && (
              <button
                className="s-bs-item"
                disabled={cardLoading[bsPlaylist.id] === "learn"}
                onClick={() => { setBottomSheet(null); void learn(bsPlaylist); }}
                style={{ color: "#c8935a" }}
              >
                {cardLoading[bsPlaylist.id] === "learn" ? "Analyse…" : "Learn"}
              </button>
            )}
            {bsPlaylist.enabled && (
              <button
                className="s-bs-item"
                onClick={() => {
                  setBottomSheet(null);
                  setFromDescText(bsPlaylist.llm_help_text ?? "");
                  setFromDescError(null);
                  setModal({ type: "from-desc", playlistId: bsPlaylist.id, playlistName: bsPlaylist.name });
                }}
              >
                Décrire la vibe
              </button>
            )}
            <button
              className="s-bs-item"
              onClick={() => {
                setBottomSheet(null);
                setEditDescription(bsPlaylist.description ?? "");
                setEditColor(bsPlaylist.color ?? null);
                setModal({ type: "edit", playlistId: bsPlaylist.id, playlistName: bsPlaylist.name, currentDescription: bsPlaylist.description, currentColor: bsPlaylist.color });
              }}
            >
              Modifier
            </button>
            <button
              className="s-bs-item"
              disabled={cardLoading[bsPlaylist.id] === "toggle"}
              onClick={() => { setBottomSheet(null); void toggle(bsPlaylist); }}
            >
              {cardLoading[bsPlaylist.id] === "toggle" ? "…" : bsPlaylist.enabled ? "Désactiver" : "Activer"}
            </button>

            <div className="s-bs-sep" />

            {/* Reorder — active playlists */}
            {bsPlaylist.enabled && (bsIdx > 0 || bsIdx < active.length - 1) && (
              <>
                {bsIdx > 0 && (
                  <button
                    className="s-bs-item"
                    onClick={() => { void moveUp(bsPlaylist.id); setBottomSheet(null); }}
                  >
                    ↑ Remonter
                  </button>
                )}
                {bsIdx < active.length - 1 && (
                  <button
                    className="s-bs-item"
                    onClick={() => { void moveDown(bsPlaylist.id); setBottomSheet(null); }}
                  >
                    ↓ Descendre
                  </button>
                )}
                <div className="s-bs-sep" />
              </>
            )}

            {/* Recompute — active playlists */}
            {bsPlaylist.enabled && (
              <button
                className="s-bs-item"
                disabled={cardLoading[bsPlaylist.id] === "recompute"}
                onClick={() => void recompute(bsPlaylist.id)}
              >
                {cardLoading[bsPlaylist.id] === "recompute" ? "Calcul…" : "Recompute centroïde"}
              </button>
            )}

            {/* Supprimer — toutes les playlists */}
            <div className="s-bs-sep" />
            <button
              className="s-bs-item s-bs-item-danger"
              disabled={cardLoading[bsPlaylist.id] === "delete"}
              onClick={() => {
                setBottomSheet(null);
                setModal({ type: "confirm-delete", playlistId: bsPlaylist.id, playlistName: bsPlaylist.name });
              }}
            >
              Supprimer
            </button>

            <div className="s-bs-sep" style={{ marginTop: 4 }} />
            <button className="s-bs-item s-bs-item-dim" onClick={() => setBottomSheet(null)}>
              Annuler
            </button>
          </div>
        </>
      )}

      {/* Toast */}
      {toast && <div className="s-toast">{toast}</div>}
    </>
  );
}

// ── PlaylistRow ───────────────────────────────────────────────────────────────

interface RowProps {
  p: PlaylistData;
  swatch: string;
  load: string | undefined;
  isDragging: boolean;
  isOver: boolean;
  draggable: boolean;
  isDesktop: boolean;
  onToggle: () => void;
  onLearn?: () => void;
  onFromDesc?: () => void;
  onRecompute?: () => void;
  onRequestDelete?: () => void;
  onOpenBottomSheet?: () => void;
  onDragStart?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
  onDrop?: (e: React.DragEvent) => void;
}

function PlaylistRow({
  p, swatch, load, isDragging, isOver, draggable, isDesktop,
  onToggle, onLearn, onFromDesc, onRecompute, onRequestDelete, onOpenBottomSheet,
  onDragStart, onDragOver, onDragEnd, onDrop,
}: RowProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const menuWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dropdownOpen) return;
    function onMouseDown(e: MouseEvent) {
      if (menuWrapRef.current && !menuWrapRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setDropdownOpen(false);
    }
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [dropdownOpen]);

  const learnedAt = p.learned_at
    ? new Date(p.learned_at).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })
    : null;

  const ddItem: React.CSSProperties = {
    display: "block", width: "100%", textAlign: "left",
    padding: "9px 14px", background: "transparent", border: "none",
    cursor: "pointer", fontSize: 12, color: "var(--ink-mid)",
    transition: "background 0.1s",
  };

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDrop={onDrop}
      className="s-pl-row"
      style={{
        opacity: isDragging ? 0.35 : 1,
        borderColor: isOver ? "var(--terra)" : undefined,
        outline: isOver ? "1px solid var(--terra-border)" : "none",
      }}
    >
      {draggable && <div className="s-drag-handle" title="Réordonner">⠿</div>}

      {/* Main zone */}
      <Link href={`/playlists/${p.id}`} className="s-pl-row-main">
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: swatch, flexShrink: 0 }} />
        <div className="s-pl-row-info">
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span className="font-fraunces" style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>
              {p.name}
            </span>
            {!p.enabled && (
              <span style={{
                fontSize: 9, fontWeight: 500, letterSpacing: "0.05em", textTransform: "uppercase",
                color: "var(--ink-dim)", background: "var(--surface2)",
                border: "1px solid var(--border-strong)", borderRadius: 4, padding: "1px 5px",
              }}>
                inactif
              </span>
            )}
          </div>
          {p.description && (
            <p style={{ fontSize: 11, color: "var(--ink-dim)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {p.description}
            </p>
          )}
          {learnedAt && (
            <p style={{ fontSize: 10, color: swatch, opacity: 0.8, marginTop: 2 }}>Appris le {learnedAt}</p>
          )}
        </div>
        <div className="s-pl-row-stats" style={{ flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
            <span className="font-fraunces" style={{ fontSize: 18, fontWeight: 600, color: swatch }}>{p.total}</span>
            {p.not_synced > 0 && (
              <span style={{ fontSize: 10, color: "var(--terra)", background: "var(--terra-light)", border: "1px solid var(--terra-border)", padding: "1px 6px", borderRadius: 12 }}>
                +{p.not_synced}
              </span>
            )}
          </div>
          <span style={{ fontSize: 9, color: "var(--ink-dimmer)", textTransform: "uppercase", letterSpacing: "0.05em" }}>tracks</span>
        </div>
      </Link>

      {/* Desktop actions */}
      <div className="s-pl-row-actions">
        {/* Learn — amber */}
        {p.enabled && onLearn && (
          <button
            className="s-btn s-btn-sm"
            onClick={onLearn}
            disabled={!!load}
            style={{ background: "rgba(200,147,90,0.12)", borderColor: "rgba(200,147,90,0.3)", color: "#c8935a" }}
          >
            {load === "learn" ? "…" : "Learn"}
          </button>
        )}

        {/* Décrire — neutral secondary */}
        {p.enabled && onFromDesc && (
          <button
            className="s-btn s-btn-sm"
            onClick={onFromDesc}
            disabled={!!load}
            style={{ background: "rgba(255,255,255,0.04)", borderColor: "rgba(255,255,255,0.10)", color: "var(--ink-dim)" }}
          >
            Décrire
          </button>
        )}

        {/* Toggle — playlist color when active, gray when inactive */}
        <button
          className="s-btn s-btn-sm"
          onClick={onToggle}
          disabled={!!load}
          title={p.enabled ? "Désactiver" : "Activer"}
          style={p.enabled ? {
            background: hexToRgba(swatch, 0.12),
            borderColor: hexToRgba(swatch, 0.3),
            color: swatch,
          } : {
            background: "rgba(255,255,255,0.03)",
            borderColor: "rgba(255,255,255,0.08)",
            color: "var(--ink-dim)",
          }}
        >
          {load === "toggle" ? "…" : (
            <>
              <span style={{
                display: "inline-block", width: 6, height: 6, borderRadius: "50%",
                background: p.enabled ? swatch : "var(--ink-dimmer)",
                marginRight: 5, verticalAlign: "middle",
              }} />
              {p.enabled ? "On" : "Off"}
            </>
          )}
        </button>

        {/* ··· — dropdown on desktop, bottom sheet on mobile */}
        <div ref={menuWrapRef} style={{ position: "relative" }}>
          <button
            className="s-btn s-btn-sm"
            title="Plus d'options"
            aria-label="Plus d'options"
            aria-expanded={dropdownOpen}
            onClick={() => {
              if (isDesktop) setDropdownOpen((v) => !v);
              else onOpenBottomSheet?.();
            }}
          >
            ⋯
          </button>

          {isDesktop && dropdownOpen && (
            <div style={{
              position: "absolute", bottom: "calc(100% + 6px)", right: 0,
              background: "var(--surface)", border: "1px solid var(--border-strong)",
              borderRadius: 10, boxShadow: "var(--shadow-md)", zIndex: 200,
              minWidth: 176, overflow: "hidden",
            }}>
              {onRecompute && p.enabled && (
                <button
                  style={ddItem}
                  disabled={load === "recompute"}
                  onClick={() => { setDropdownOpen(false); onRecompute(); }}
                >
                  {load === "recompute" ? "Calcul…" : "Recompute centroïde"}
                </button>
              )}
              <div style={{ height: 1, background: "var(--border)" }} />
              <button
                style={{ ...ddItem, color: "#b85c48" }}
                onClick={() => { setDropdownOpen(false); onToggle(); }}
              >
                {p.enabled ? "Désactiver" : "Activer"}
              </button>
              {onRequestDelete && (
                <>
                  <div style={{ height: 1, background: "var(--border)" }} />
                  <button
                    style={{ ...ddItem, color: "#b85c48" }}
                    onClick={() => { setDropdownOpen(false); onRequestDelete(); }}
                  >
                    Supprimer
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Mobile-only ⋯ button */}
      <button
        className="s-pl-menu-btn s-btn"
        onClick={onOpenBottomSheet}
        title="Options"
        aria-label="Options"
      >
        ⋯
      </button>
    </div>
  );
}
