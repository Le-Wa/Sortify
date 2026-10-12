import { GLOSSARY, GOOD_TO_KNOW, STORIES } from "./content";

/** « Comment ça marche », dépliable, sur la page de connexion. */
export function HowItWorks({ open = false }: { open?: boolean }) {
  return (
    <details className="howto" open={open}>
      <summary className="howto__head">
        <span>Comment ça marche</span>
        <span aria-hidden="true">›</span>
      </summary>
      <div className="stack howto__body">
        <ol className="howto__steps">
          {STORIES.map((s, i) => (
            <li key={s.title}>
              <span className="mono">0{i + 1}</span>
              <span>
                <b>{s.title}</b> {s.text}
              </span>
            </li>
          ))}
        </ol>
        <div className="stack" style={{ gap: 4 }}>
          <span className="label">Les mots du disquaire</span>
          {GLOSSARY.map((g) => (
            <span key={g.word} className="small">
              <b>{g.word}</b> : {g.meaning}
            </span>
          ))}
        </div>
        <div className="stack" style={{ gap: 4 }}>
          <span className="label">Bon à savoir</span>
          {GOOD_TO_KNOW.map((t) => (
            <span key={t} className="small">
              · {t}
            </span>
          ))}
        </div>
      </div>
    </details>
  );
}
