"use client";

import { HowItWorks } from "../../ui/pedagogie/HowItWorks";
import { NextSteps } from "../../ui/pedagogie/NextSteps";
import { ProposalIntro } from "../../ui/pedagogie/ProposalIntro";
import { StoryGuide } from "../../ui/pedagogie/StoryGuide";
import { WaitTips } from "../../ui/pedagogie/WaitTips";
import { WelcomeCard } from "../../ui/pedagogie/WelcomeCard";
import { Sleeve } from "../../ui/Sleeve";

const noop = () => undefined;

function Phone({ caption, children }: { caption: string; children: React.ReactNode }) {
  return (
    <figure style={{ margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
      <figcaption className="mono small muted">{caption}</figcaption>
      <div style={{ width: 360, height: 740, overflow: "hidden", borderRadius: 28, background: "var(--ground)", border: "1px solid var(--line)" }}>
        <div className="page page--bare" style={{ minHeight: "100%", maxWidth: 360 }}>
          {children}
        </div>
      </div>
    </figure>
  );
}

function Segments({ filled }: { filled: number }) {
  return (
    <div className="segments" aria-hidden="true">
      {Array.from({ length: 30 }, (_, i) => (
        <span key={i} className={i < filled ? "on" : i === filled ? "now" : undefined} />
      ))}
    </div>
  );
}

export function Board() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 360px)", gap: 28, padding: 28, background: "var(--ground)" }}>
      <Phone caption="1 · Connexion : « Comment ça marche »">
        <span className="display display--s">Sortify</span>
        <h1 className="display" style={{ fontSize: 40 }}>
          Tu likes.
          <br />
          Sortify range.
        </h1>
        <HowItWorks open />
        <div className="grow" />
        <button type="button" className="btn">
          Se connecter avec Spotify
        </button>
      </Phone>
      {[0, 1, 2, 3].map((k) => (
        <Phone key={k} caption={`${k + 2} · Mini-guide, écran ${k + 1}/4 (après le code)`}>
          <StoryGuide onDone={noop} start={k} />
        </Phone>
      ))}
      <Phone caption="6 · Attente : coin du disquaire">
        <div className="label muted">Première analyse · ~14 min en tout</div>
        <h1 className="display" style={{ fontSize: 48 }}>
          On fouille
          <br />
          tes bacs.
        </h1>
        <div>
          <span className="mono" style={{ fontSize: 30 }}>0412</span> <span className="mono muted small">/ 1 160 likes</span>
          <Segments filled={11} />
          <div style={{ marginTop: 8, fontSize: 14 }}>Genres, énergie et ambiances…</div>
        </div>
        <WaitTips step="enrich" start={1} />
      </Phone>
      <Phone caption="7 · Proposition : comment la lire">
        <div className="row between label">
          <span>1 000 likes · les plus récents</span>
          <span>13 bacs</span>
        </div>
        <h1 className="display" style={{ fontSize: 36 }}>
          Voici l&apos;âme de ta discothèque.
        </h1>
        <ProposalIntro />
        <p className="notice" style={{ margin: 0 }}>
          <b>Divers : 140 titres</b> (12 %) n&apos;ont pas de bac.
        </p>
      </Phone>
      <Phone caption="8 · Création : et ensuite ?">
        <div className="label muted">Création dans Spotify</div>
        <h1 className="display" style={{ fontSize: 48 }}>
          On presse
          <br />
          tes 13 bacs.
        </h1>
        <div className="row" style={{ gap: 8 }}>
          <Sleeve name="Rap français" color="#B9A8FF" size={70} mark={{ shape: "triangle", outline: false }} />
          <Sleeve name="Soul nocturne" color="#2448D8" size={70} mark={{ shape: "crescent", outline: false }} />
          <Sleeve name="Fin de nuit" color="#FF9FCB" size={70} mark={{ shape: "horizon", outline: true }} />
        </div>
        <NextSteps />
      </Phone>
      <Phone caption="9 · Accueil : bienvenue (une fois)">
        <div className="row between">
          <span className="display display--s">Sortify</span>
        </div>
        <WelcomeCard nextTri="lundi 19 oct. vers 08:00" onClose={noop} />
      </Phone>
    </div>
  );
}
