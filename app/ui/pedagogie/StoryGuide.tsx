"use client";

import { useState } from "react";
import { Sleeve } from "../Sleeve";
import { STORIES, type Story } from "./content";

function Visual({ kind }: { kind: Story["visual"] }) {
  if (kind === "likes") {
    return (
      <div className="story__visual">
        {["#B9A8FF", "#FFD23F", "#14A3A3"].map((c, i) => (
          <span key={c} className="story__like" style={{ background: c, transform: `rotate(${(i - 1) * 7}deg) translateY(${i === 1 ? -8 : 0}px)` }}>
            ♥
          </span>
        ))}
      </div>
    );
  }
  if (kind === "bacs") {
    return (
      <div className="story__visual">
        <Sleeve name="Rap français" color="#B9A8FF" size={96} mark={{ shape: "triangle", outline: false }} rotate={-6} />
        <Sleeve name="House solaire" color="#FFD23F" size={96} mark={{ shape: "sun", outline: false }} />
        <Sleeve name="Fin de nuit" color="#FF9FCB" size={96} mark={{ shape: "crescent", outline: true }} rotate={6} />
      </div>
    );
  }
  if (kind === "choix") {
    return (
      <div className="story__visual story__visual--list">
        {[
          { name: "Rap français", on: true },
          { name: "Afrobeats", on: true },
          { name: "Pop indé", on: false },
        ].map((b) => (
          <span key={b.name} className="story__row">
            <span className={b.on ? "" : "muted"} style={{ fontWeight: 700 }}>
              {b.name}
            </span>
            <span className={`switch ${b.on ? "is-on" : ""}`} aria-hidden="true" />
          </span>
        ))}
      </div>
    );
  }
  return (
    <div className="story__visual story__visual--list">
      <span className="story__row">
        <b>Lundi 8 h</b>
        <span className="mono small">+23 titres</span>
      </span>
      <span className="story__row">
        <span>À trier</span>
        <span className="mono small">3</span>
      </span>
      <span className="story__row">
        <span>Divers</span>
        <span className="mono small">1</span>
      </span>
    </div>
  );
}

/** Mini-guide en 4 écrans (« stories ») : toucher à droite avance, à gauche recule. */
export function StoryGuide({ onDone, start = 0 }: { onDone: () => void; start?: number }) {
  const [i, setI] = useState(start);
  const story = STORIES[i];
  const last = i === STORIES.length - 1;
  return (
    <section className="story" aria-roledescription="guide" aria-label={`Comment ça marche, ${i + 1} sur ${STORIES.length}`}>
      <div className="story__bars" aria-hidden="true">
        {STORIES.map((_, k) => (
          <span key={k} className={k <= i ? "on" : undefined} />
        ))}
      </div>
      <div className="row between">
        <span className="label">Comment ça marche</span>
        <button type="button" className="btn btn--quiet btn--sm" onClick={onDone}>
          Passer
        </button>
      </div>
      <Visual kind={story.visual} />
      <h2 className="display display--xl" style={{ margin: 0 }}>
        {story.title}
      </h2>
      <p style={{ margin: 0, fontSize: 16, lineHeight: 1.45 }}>{story.text}</p>
      <div className="grow" />
      <div className="row" style={{ gap: 8 }}>
        {i > 0 ? (
          <button type="button" className="btn btn--ghost" style={{ width: "auto", padding: "0 18px" }} onClick={() => setI(i - 1)} aria-label="Écran précédent">
            ‹
          </button>
        ) : null}
        <button type="button" className="btn grow" onClick={() => (last ? onDone() : setI(i + 1))}>
          {last ? "C'est parti" : "Suivant"}
        </button>
      </div>
      {last ? <p className="small muted" style={{ margin: 0, textAlign: "center" }}>10 à 20 min la première fois · tu peux fermer l&apos;app</p> : null}
    </section>
  );
}
