import { Sleeve } from "../Sleeve";

/** En tête de la proposition : comment la lire, repliable. */
export function ProposalIntro({ open = true }: { open?: boolean }) {
  return (
    <details className="howto howto--card" open={open}>
      <summary className="howto__head">
        <span>Comment lire ta proposition</span>
        <span aria-hidden="true">›</span>
      </summary>
      <div className="stack howto__body" style={{ gap: 12 }}>
        <div className="row" style={{ gap: 12 }}>
          <Sleeve name="Rap" color="#B9A8FF" size={44} mark={{ shape: "triangle", outline: false }} />
          <span className="small">
            <b>Forme pleine : une scène.</b> Un genre, une couleur. Un titre a en général un seul bac de scène.
          </span>
        </div>
        <div className="row" style={{ gap: 12 }}>
          <Sleeve name="Nuit" color="#FF9FCB" size={44} mark={{ shape: "crescent", outline: true }} />
          <span className="small">
            <b>Forme en contour : une ambiance ou un moment.</b> Elle traverse les scènes : un titre peut y aller en plus de sa scène.
          </span>
        </div>
        <div className="row" style={{ gap: 12 }}>
          <span className="switch is-on" aria-hidden="true" style={{ flex: "none" }} />
          <span className="small">
            <b>Garde ou retire</b> chaque bac. Un bac retiré envoie ses titres dans Divers : le compteur te le montre.
          </span>
        </div>
        <span className="small">
          <b>Déplie un bac</b> pour écouter ses exemples, le renommer, demander une autre idée ou le fusionner. Il manque un bac ? Décris-le, l&apos;IA le crée.
        </span>
        <span className="small muted">Rien n&apos;arrive dans Spotify avant le bouton « Créer … bacs dans Spotify », en bas.</span>
      </div>
    </details>
  );
}
