"use client";

import { markFor } from "@/lib/cover-shapes";
import { Sleeve } from "../../ui/Sleeve";

// Planche statique : données inventées à partir des vraies bibliothèques (13/10/2026), rien n'est branché.

function Phone({ caption, children }: { caption: string; children: React.ReactNode }) {
  return (
    <figure style={{ margin: 0, display: "flex", flexDirection: "column", gap: 8 }}>
      <figcaption className="mono small muted">{caption}</figcaption>
      <div style={{ width: 360, height: 740, overflow: "hidden", borderRadius: 28, background: "var(--ground)", border: "1px solid var(--line)", position: "relative" }}>
        <div className="page page--bare" style={{ minHeight: "100%", maxWidth: 360 }}>
          {children}
        </div>
      </div>
    </figure>
  );
}

const sleeve = (name: string, color: string, axis = "scène", size = 44) => <Sleeve name={name} color={color} size={size} mark={markFor({ name, axis })} />;

/** Pochette de titre factice (carré de couleur). */
const Cover = ({ hue }: { hue: number }) => (
  <span style={{ width: 44, height: 44, flex: "none", borderRadius: 4, background: `hsl(${hue} 45% 45%)` }} aria-hidden="true" />
);

function Chip({ label, on = false }: { label: string; on?: boolean }) {
  return (
    <span
      className="chip"
      style={{ fontSize: 13, padding: "8px 12px", minHeight: 36, display: "inline-flex", alignItems: "center", background: on ? "var(--ink)" : "transparent", color: on ? "var(--ground)" : "inherit", borderColor: "var(--line)" }}
    >
      {label}
    </span>
  );
}

function Track({ title, artist, hue, right, checked }: { title: string; artist: string; hue: number; right?: React.ReactNode; checked?: boolean }) {
  return (
    <li className="recent__item">
      {checked !== undefined ? <input type="checkbox" defaultChecked={checked} style={{ width: 22, height: 22, flex: "none", accentColor: "var(--accent)" }} aria-label={title} /> : null}
      <Cover hue={hue} />
      <span className="grow" style={{ minWidth: 0 }}>
        <span className="recent__title" style={{ display: "block" }}>
          {title}
        </span>
        <span className="small muted">{artist}</span>
      </span>
      {right}
    </li>
  );
}

function BottomBar({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: 16, background: "var(--ground)", borderTop: "1px solid var(--line)", display: "flex", gap: 8, alignItems: "center" }}>
      {children}
    </div>
  );
}

const Section = ({ title }: { title: string }) => (
  <h2 className="display" style={{ gridColumn: "1 / -1", fontSize: 36, margin: "24px 0 0" }}>
    {title}
  </h2>
);

export function Board() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 360px)", gap: 28, padding: 28, background: "var(--ground)" }}>
      <Section title="Divers" />
      <Phone caption="D1 · Filtres par genre, par artiste, rangement par lot">
        <span className="label">Caisse Divers · 134 titres</span>
        <div className="chips" style={{ gap: 6 }}>
          <Chip label="Tout 134" />
          <Chip label="Électro 61" on />
          <Chip label="Pop-rock 27" />
          <Chip label="Rap 21" />
          <Chip label="Sans genre 29" />
        </div>
        <div className="segmented" role="tablist">
          <button type="button" className="segmented__item">
            Titres
          </button>
          <button type="button" className="segmented__item" aria-pressed="true" style={{ background: "var(--ink)", color: "var(--ground)" }}>
            Par artiste
          </button>
        </div>
        <div className="row between">
          <b>Kelly Boesch · 4 titres</b>
          <button type="button" className="btn btn--ghost btn--sm">
            Ranger les 4…
          </button>
        </div>
        <ul className="recent">
          <Track title="Fade Away" artist="Kelly Boesch" hue={200} checked />
          <Track title="Nights Like This" artist="Kelly Boesch" hue={210} checked />
          <Track title="Lost Signal" artist="Kelly Boesch" hue={220} checked={false} />
        </ul>
        <div className="row between">
          <b>Galion · 3 titres</b>
          <button type="button" className="btn btn--ghost btn--sm">
            Ranger les 3…
          </button>
        </div>
        <ul className="recent">
          <Track title="Aube" artist="Galion" hue={30} checked />
        </ul>
        <BottomBar>
          <span className="small grow">
            <b>3 titres</b> cochés
          </span>
          <button type="button" className="btn btn--sm">
            Ranger dans…
          </button>
        </BottomBar>
      </Phone>

      <Phone caption="D2 · Swipe de Divers avec l'avis déjà gardé (sans IA)">
        <span className="label">Divers · 1 / 134 · avis de l&apos;IA gardé</span>
        <div className="deck">
          <span className="deck__hint deck__hint--left">← Reste</span>
          <span className="deck__hint deck__hint--right">Ranger →</span>
          <div className="deck__card" style={{ background: "hsl(280 40% 40%)", animation: "none" }} />
        </div>
        <div>
          <div className="triage__title">Diana (You Don&apos;t Even Know)</div>
          <div className="muted" style={{ fontSize: 14 }}>
            Fred again..
          </div>
        </div>
        <div className="panel" style={{ gap: 6 }}>
          <span className="small muted">L&apos;IA hésitait, à l&apos;import :</span>
          <span className="row" style={{ gap: 8 }}>
            {sleeve("House solaire", "#f2c94c")}
            <span className="small grow">House solaire · « plutôt UK garage que house »</span>
          </span>
          <span className="row" style={{ gap: 8 }}>
            {sleeve("Fin de nuit", "#f4a7c4", "ambiance")}
            <span className="small grow">Fin de nuit · en plus, possible</span>
          </span>
        </div>
        <span className="small muted">Pas d&apos;avis gardé (titres d&apos;avant) : l&apos;IA est demandée par paquet, ~0,15 centime le titre.</span>
      </Phone>

      <Phone caption="D3 · « Fais-moi des bacs avec Divers » (cas de Jérémy)">
        <span className="label">Caisse Divers · 1 034 titres</span>
        <div className="crate-card" style={{ flexDirection: "column", alignItems: "flex-start", gap: 8 }}>
          <b style={{ fontSize: 15 }}>Beaucoup de titres attendent ici.</b>
          <span className="small">L&apos;IA peut y chercher des groupes qui méritent leur bac. ~1 min, ~0,60 $.</span>
          <button type="button" className="btn btn--sm">
            Fais-moi des bacs avec Divers
          </button>
        </div>
        <section className="suggestion card">
          {sleeve("Rap US 2010s", "#111111", "scène", 64)}
          <div className="grow stack" style={{ gap: 6 }}>
            <b style={{ fontSize: 15 }}>Nouveau bac : « Rap US 2010s » ?</b>
            <span style={{ fontSize: 13 }}>312 titres de Divers : Drake, Travis Scott, Young Thug, Lil Wayne…</span>
            <span className="row" style={{ gap: 6 }}>
              <button type="button" className="btn btn--sm">
                Créer
              </button>
              <button type="button" className="btn btn--ghost btn--sm">
                Non merci
              </button>
            </span>
          </div>
        </section>
        <section className="suggestion card">
          {sleeve("Rap créole", "#111111", "scène", 64)}
          <div className="grow stack" style={{ gap: 6 }}>
            <b style={{ fontSize: 15 }}>Nouveau bac : « Rap créole » ?</b>
            <span style={{ fontSize: 13 }}>141 titres : Kalash, Kalipsxau, Meryl…</span>
            <span className="row" style={{ gap: 6 }}>
              <button type="button" className="btn btn--sm">
                Créer
              </button>
              <button type="button" className="btn btn--ghost btn--sm">
                Non merci
              </button>
            </span>
          </div>
        </section>
      </Phone>

      <Section title="Importer ses playlists" />
      <Phone caption="P1 · Révélation : « Tes playlists » (après l'import des likes)">
        <span className="label">Étape 2 sur 3 · facultatif</span>
        <h1 className="display" style={{ fontSize: 40 }}>
          Tu ranges
          <br />
          déjà un peu ?
        </h1>
        <span className="small">Coche les playlists qui sont de vrais bacs pour toi. On en fait des bacs Sortify ; les tiennes ne bougent pas.</span>
        <ul className="recent">
          <Track title="Running" artist="84 titres · 61 likés" hue={10} checked />
          <Track title="Soirée chez moi" artist="120 titres · 97 likés" hue={330} checked />
          <Track title="Chill dimanche" artist="46 titres · 38 likés" hue={150} checked={false} />
          <Track title="Mes sons" artist="812 titres · très large" hue={45} checked />
        </ul>
        <BottomBar>
          <button type="button" className="btn btn--quiet btn--sm">
            Passer
          </button>
          <button type="button" className="btn grow">
            Reprendre 3 playlists · ~1,20 $
          </button>
        </BottomBar>
      </Phone>

      <Phone caption="P2 · Playlist trop large : découpage proposé">
        <span className="label">« Mes sons » · 812 titres</span>
        <h1 className="display" style={{ fontSize: 36 }}>
          Trois directions
          <br />
          dans une playlist.
        </h1>
        <span className="small">
          Seuls 41 % de ses titres y retourneraient avec une seule fiche : elle est trop large pour être rangée automatiquement. On te propose de la découper.
        </span>
        <div className="stack" style={{ gap: 10 }}>
          {[
            ["Rap FR actuel", "#e85d3a", "310 titres"],
            ["Afro solaire", "#f2c94c", "190 titres"],
            ["Électro de nuit", "#3a5be8", "120 titres"],
          ].map(([n, c, t]) => (
            <span key={n} className="row" style={{ gap: 12 }}>
              {sleeve(n, c, "scène", 56)}
              <span className="grow">
                <b>{n}</b>
                <br />
                <span className="small muted">{t}</span>
              </span>
            </span>
          ))}
          <span className="small muted">192 titres restants : Divers.</span>
        </div>
        <div className="grow" />
        <button type="button" className="btn">
          En faire 3 bacs
        </button>
        <button type="button" className="btn btn--ghost">
          La garder comme indice
        </button>
        <button type="button" className="btn btn--quiet">
          La laisser de côté
        </button>
      </Phone>

      <Phone caption="P3 · Proposition : bacs repris étiquetés « ta playlist »">
        <div className="row between label">
          <span>1 000 likes · les plus récents</span>
          <span>11 bacs</span>
        </div>
        <h1 className="display" style={{ fontSize: 40 }}>
          Voici l&apos;âme de
          <br />
          ta discothèque.
        </h1>
        {[
          ["Running", "#e8433a", "ambiance", "61 titres", true],
          ["Soirée chez moi", "#c25bd6", "moment", "97 titres", true],
          ["Rap FR actuel", "#e85d3a", "scène", "310 titres", true],
          ["Soul nocturne", "#3a2a6b", "scène", "88 titres", false],
          ["Dancehall kréyol", "#2bb673", "scène", "64 titres", false],
        ].map(([n, c, a, t, mine]) => (
          <div key={n as string} className="card row" style={{ gap: 12, padding: 10 }}>
            {sleeve(n as string, c as string, a as string, 48)}
            <span className="grow">
              <b>{n}</b>
              <br />
              <span className="small muted">{t}</span>
            </span>
            {mine ? <span className="tag">ta playlist</span> : <span className="tag">proposé</span>}
          </div>
        ))}
      </Phone>

      <Section title="Petits gains" />
      <Phone caption="G1 · À trier : filtres « Incertains » et par bac">
        <span className="label">À trier · 23 titres</span>
        <div className="chips" style={{ gap: 6 }}>
          <Chip label="Tous 23" />
          <Chip label="Incertains 9" on />
          <Chip label="Rap français 6" />
          <Chip label="House solaire 4" />
        </div>
        <span className="small muted">Incertains : l&apos;IA hésite entre deux bacs, ou n&apos;est sûre d&apos;aucun.</span>
        <div className="deck">
          <span className="deck__hint deck__hint--left">← Divers</span>
          <span className="deck__hint deck__hint--right">Ranger →</span>
          <div className="deck__card" style={{ background: "hsl(20 50% 45%)", animation: "none" }} />
        </div>
        <div className="triage__title">Ready</div>
        <div className="muted" style={{ fontSize: 14 }}>
          Dyce
        </div>
      </Phone>

      <Phone caption="G2 · Comptoir vide : petite célébration">
        <span className="label">À trier</span>
        <div className="grow" />
        <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
          {sleeve("Rap français", "#e85d3a", "scène", 84)}
          {sleeve("House solaire", "#f2c94c", "scène", 84)}
          {sleeve("Fin de nuit", "#f4a7c4", "ambiance", 84)}
        </div>
        <h1 className="display" style={{ fontSize: 56, textAlign: "center" }}>
          Comptoir
          <br />
          vide.
        </h1>
        <p className="small" style={{ textAlign: "center", margin: 0 }}>
          23 titres rangés cette semaine. Le disquaire peut fermer la boutique.
          <br />
          Prochain arrivage : lundi 8 h.
        </p>
        <span className="small muted" style={{ textAlign: "center" }}>
          Animation : les pochettes tombent dans leur bac (désactivée si « animations réduites »).
        </span>
        <div className="grow" />
      </Phone>

      <Phone caption="G3 · « Ce bac dort » (rien depuis 8 semaines)">
        <span className="label">Bacs</span>
        <section className="suggestion card">
          {sleeve("Focus instrumental", "#8fb3a8", "ambiance", 64)}
          <div className="grow stack" style={{ gap: 6 }}>
            <b style={{ fontSize: 15 }}>« Focus instrumental » dort</b>
            <span style={{ fontSize: 13 }}>Aucun titre depuis 9 semaines. Tes likes ne passent plus par là ?</span>
            <span className="row" style={{ gap: 6, flexWrap: "wrap" }}>
              <button type="button" className="btn btn--sm">
                L&apos;élargir
              </button>
              <button type="button" className="btn btn--ghost btn--sm">
                Le retirer
              </button>
              <button type="button" className="btn btn--quiet btn--sm">
                Laisser
              </button>
            </span>
          </div>
        </section>
        <div className="list">
          {[
            ["Rap français", "+21 cette semaine", ""],
            ["House solaire", "+2 cette semaine", ""],
            ["Pop indé sensible", "dernier titre il y a 4 sem.", ""],
            ["Focus instrumental", "dort · 9 sem.", "z"],
          ].map(([n, t, z]) => (
            <div key={n} className="list__row">
              <span className="grow">{n}</span>
              <span className={`small ${z ? "" : "muted"}`} style={z ? { color: "var(--accent)" } : undefined}>
                {t}
              </span>
            </div>
          ))}
        </div>
      </Phone>

      <Section title="Plus tard" />
      <Phone caption="L1 · Bilan du mois">
        <span className="label">Ton mois d&apos;octobre</span>
        <h1 className="display" style={{ fontSize: 48 }}>
          54 likes,
          <br />
          9 bacs servis.
        </h1>
        <div className="row" style={{ gap: 12 }}>
          {sleeve("Rap français", "#e85d3a", "scène", 96)}
          <span className="grow">
            <span className="label">Bac du mois</span>
            <br />
            <b>Rap français</b>
            <br />
            <span className="small muted">+21 titres · Tizzy Miller, Zamdane, Ino Casablanca</span>
          </span>
        </div>
        <div className="list">
          <div className="list__row">
            <span className="grow">Artiste du mois</span>
            <b>Fred again..</b>
          </div>
          <div className="list__row">
            <span className="grow">Nouveau bac</span>
            <b>Groove de bureau</b>
          </div>
          <div className="list__row">
            <span className="grow">Corrigés à la main</span>
            <b>6</b>
          </div>
        </div>
        <button type="button" className="btn btn--ghost">
          Partager mon mois
        </button>
      </Phone>

      <Phone caption="L2 · Ordre « DJ » dans un bac">
        <span className="label">House solaire · 84 titres</span>
        <div className="segmented">
          <button type="button" className="segmented__item">
            Récents en haut
          </button>
          <button type="button" className="segmented__item" aria-pressed="true" style={{ background: "var(--ink)", color: "var(--ground)" }}>
            Ordre DJ
          </button>
        </div>
        <span className="small muted">
          Enchaînés par tempo et énergie, en montée. Tempo connu pour 62 % des titres ; les autres sont placés d&apos;après leur énergie.
        </span>
        <ul className="recent">
          <Track title="Sunset Drive" artist="Kerri Chandler" hue={40} right={<span className="mono small">118</span>} />
          <Track title="Hold On" artist="Purple Disco Machine" hue={50} right={<span className="mono small">121</span>} />
          <Track title="Rumble" artist="Skrillex, Fred again.." hue={60} right={<span className="mono small">124</span>} />
          <Track title="Jamaican (Bam Bam)" artist="HUGEL" hue={70} right={<span className="mono small">126</span>} />
        </ul>
        <span className="small muted">Changer l&apos;ordre réécrit la playlist dans Spotify : essai à blanc d&apos;abord.</span>
      </Phone>

      <Phone caption="L3 · Bacs des potes et affinité">
        <span className="label">Les potes</span>
        <div className="card stack" style={{ gap: 10, padding: 14 }}>
          <span className="row between">
            <b>Le G 87</b>
            <span className="mono">23 % en commun</span>
          </span>
          <span className="small muted">Vous partagez Burna Boy, Rema, Jorja Smith. Visible parce que vous avez tous les deux dit oui.</span>
          <div className="row" style={{ gap: 8 }}>
            {sleeve("Dancehall kréyol", "#2bb673", "scène", 72)}
            {sleeve("Slow love", "#c25bd6", "ambiance", 72)}
            {sleeve("Afrobeats solaire", "#f2c94c", "scène", 72)}
          </div>
          <button type="button" className="btn btn--sm">
            Suivre « Afrobeats solaire »
          </button>
        </div>
      </Phone>
    </div>
  );
}
