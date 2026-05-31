"use client";

import { useState } from "react";

type Props = {
  playlistName: string;
  onNext: (vibe: string, artists: string[]) => void;
  onBack: () => void;
};

export default function S7ScratchVibe({ playlistName, onNext, onBack }: Props) {
  const [vibe, setVibe] = useState("");
  const [artistInput, setArtistInput] = useState("");
  const [artists, setArtists] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  function addArtist() {
    const a = artistInput.trim();
    if (a && !artists.includes(a)) {
      setArtists((prev) => [...prev, a]);
    }
    setArtistInput("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await onNext(vibe.trim(), artists);
    setSaving(false);
  }

  return (
    <div className="ob-screen">
      <button className="ob-back" onClick={onBack}>← Retour</button>
      <h2 className="ob-step-title">{playlistName}</h2>
      <p className="ob-step-desc">Décris l&apos;ambiance — ce qui devrait y atterrir.</p>

      <form className="ob-form" onSubmit={handleSubmit}>
        <label className="ob-label">
          Vibe (optionnel)
          <textarea
            className="ob-textarea"
            placeholder="ex: Musique pour coder le soir, pas trop rythmée, instrumentale de préférence…"
            value={vibe}
            onChange={(e) => setVibe(e.target.value)}
            rows={3}
            maxLength={300}
          />
        </label>

        <label className="ob-label">
          Artistes exemples (optionnel)
          <div className="ob-artist-row">
            <input
              className="ob-input ob-input-sm"
              type="text"
              placeholder="Nom d'artiste"
              value={artistInput}
              onChange={(e) => setArtistInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); addArtist(); }
              }}
            />
            <button type="button" className="s-btn s-btn-sm" onClick={addArtist}>
              +
            </button>
          </div>
          {artists.length > 0 && (
            <div className="ob-artist-chips">
              {artists.map((a) => (
                <span key={a} className="ob-chip">
                  {a}
                  <button
                    type="button"
                    className="ob-chip-remove"
                    onClick={() => setArtists((prev) => prev.filter((x) => x !== a))}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </label>

        <button className="s-btn s-btn-primary ob-cta" disabled={saving}>
          {saving ? "Création…" : "Créer la playlist →"}
        </button>
      </form>
    </div>
  );
}
