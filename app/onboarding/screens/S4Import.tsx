"use client";

import { useState, useEffect } from "react";

interface SpotifyPlaylist {
  id: string;
  name: string;
  tracks_total: number;
  cover_url: string | null;
  is_owned: boolean;
}

type Props = {
  onNext: (selectedIds: string[]) => void;
  onBack: () => void;
};

export default function S4Import({ onNext, onBack }: Props) {
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/spotify/my-playlists")
      .then((r) => r.json())
      .then((data) => {
        const filtered = (Array.isArray(data) ? data : []).filter(
          (p: SpotifyPlaylist) => p.is_owned
        );
        setPlaylists(filtered);
      })
      .finally(() => setLoading(false));
  }, []);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (loading) {
    return <div className="ob-screen ob-loading">Chargement de tes playlists…</div>;
  }

  return (
    <div className="ob-screen">
      <button className="ob-back" onClick={onBack}>← Retour</button>
      <h2 className="ob-step-title">Importe tes playlists</h2>
      <p className="ob-step-desc">
        Sélectionne les playlists que Sortify doit apprendre. ({selected.size} sélectionnée{selected.size !== 1 ? "s" : ""})
      </p>

      <div className="ob-playlist-list">
        {(playlists ?? []).map((pl) => (
          <button
            key={pl.id}
            className={`ob-playlist-item ${selected.has(pl.id) ? "ob-selected" : ""}`}
            onClick={() => toggle(pl.id)}
          >
            {pl.cover_url && (
              <img src={pl.cover_url} alt="" className="ob-playlist-cover" />
            )}
            <div className="ob-playlist-info">
              <span className="ob-playlist-name">{pl.name}</span>
              <span className="ob-playlist-meta">{pl.tracks_total} titres</span>
            </div>
            <span className="ob-check">{selected.has(pl.id) ? "✓" : ""}</span>
          </button>
        ))}
      </div>

      <button
        className="s-btn s-btn-primary ob-cta"
        disabled={selected.size === 0}
        onClick={() => onNext([...selected])}
      >
        Importer {selected.size > 0 ? `(${selected.size})` : ""} →
      </button>
    </div>
  );
}
