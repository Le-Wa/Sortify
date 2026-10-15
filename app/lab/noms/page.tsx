import { notFound } from "next/navigation";
import { lineWidthEm } from "@/lib/sleeve-layout";
import { SleeveMarkSvg } from "@/lib/sleeve-mark";

// Planche des noms (15/10/2026) : le même écran avec cinq noms, pour juger à l'œil (développement seulement).

interface Candidate {
  name: string;
  /** Sujet des phrases de l'app (« Le Chineur a rangé… »). */
  who: string;
  note: string;
}

const NAMES: Candidate[] = [
  { name: "Diggeur", who: "Diggeur", note: "« digger » à la française" },
  { name: "DiggBot", who: "DiggBot", note: "fouiller + robot" },
  { name: "DiggerBot", who: "DiggerBot", note: "le digger robot, en toutes lettres" },
  { name: "Disquaire", who: "Ton disquaire", note: "le métier, tel quel" },
  { name: "Chineur", who: "Le Chineur", note: "chiner : fouiller les brocantes" },
];

const COL = 280;
const ORANGE = "#FF6A13";

function AppIcon({ name, size }: { name: string; size: number }) {
  const pad = size * 0.09;
  const fontSize = Math.min(size * 0.3, (size - 2 * pad) / lineWidthEm(name));
  const radius = size * 0.22;
  return (
    <span
      aria-hidden="true"
      style={{
        position: "relative",
        display: "block",
        width: size,
        height: size,
        borderRadius: radius,
        background: ORANGE,
        color: "#111111",
        overflow: "hidden",
        flex: "none",
      }}
    >
      <SleeveMarkSvg mark={{ shape: "starburst", outline: false }} ink="#111111" box={size * 0.5} left={size * 0.48} top={size * 0.02} />
      {size >= 100 ? (
        <span className="mono" style={{ position: "absolute", left: pad, top: pad, fontSize: size * 0.065, textTransform: "lowercase" }}>
          {name}
        </span>
      ) : null}
      <span
        className="display"
        style={{ position: "absolute", left: pad, bottom: pad * 0.9, fontSize, lineHeight: 0.86, whiteSpace: "nowrap" }}
      >
        {name}
      </span>
    </span>
  );
}

function Row({ title, children }: { title: string; children: (c: Candidate) => React.ReactNode }) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <p className="label muted" style={{ margin: 0 }}>
        {title}
      </p>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${NAMES.length}, ${COL}px)`, gap: 24 }}>
        {NAMES.map((c) => (
          <div key={c.name}>{children(c)}</div>
        ))}
      </div>
    </section>
  );
}

const WALLPAPER = "linear-gradient(160deg, #3b2a5c 0%, #1d3b4f 55%, #0f1e2a 100%)";

/** Faux voisins sur l'écran d'accueil du téléphone. */
const NEIGHBOURS = [
  { label: "Photos", bg: "#f2f2f2" },
  { label: "Plans", bg: "#7fc3a0" },
  { label: "Météo", bg: "#4a8fe0" },
];

export default function NomsPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main style={{ padding: "28px 28px 80px", display: "flex", flexDirection: "column", gap: 28, width: "max-content" }}>
      <h1 className="display" style={{ fontSize: 40 }}>
        Le nom · cinq pistes
      </h1>

      <Row title="01 · Le nom">
        {(c) => (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span className="display" style={{ fontSize: 46 }}>
              {c.name}
            </span>
            <span className="small muted">{c.note}</span>
          </div>
        )}
      </Row>

      <Row title="02 · Icône, et sur l'écran d'accueil">
        {(c) => (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <AppIcon name={c.name} size={168} />
            <div style={{ background: WALLPAPER, borderRadius: 18, padding: "16px 14px", display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
              {NEIGHBOURS.slice(0, 2).map((n) => (
                <span key={n.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                  <span style={{ width: 54, height: 54, borderRadius: 12, background: n.bg }} />
                  <span style={{ color: "#fff", fontSize: 10.5, fontFamily: "system-ui" }}>{n.label}</span>
                </span>
              ))}
              <span style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                <AppIcon name={c.name} size={54} />
                <span style={{ color: "#fff", fontSize: 10.5, fontFamily: "system-ui", maxWidth: 62, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {c.name}
                </span>
              </span>
              <span style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                <span style={{ width: 54, height: 54, borderRadius: 12, background: NEIGHBOURS[2].bg }} />
                <span style={{ color: "#fff", fontSize: 10.5, fontFamily: "system-ui" }}>{NEIGHBOURS[2].label}</span>
              </span>
            </div>
          </div>
        )}
      </Row>

      <Row title="03 · Écran de connexion">
        {(c) => (
          <div
            style={{
              height: 440,
              borderRadius: 24,
              border: "1px solid var(--line)",
              padding: "18px 16px",
              display: "flex",
              flexDirection: "column",
              gap: 16,
              overflow: "hidden",
            }}
          >
            <div className="row between label">
              <span className="display display--s">{c.name}</span>
              <span style={{ whiteSpace: "nowrap", fontSize: 10 }}>Range tes likes</span>
            </div>
            <h2 className="display" style={{ fontSize: 50 }}>
              Tu likes.
              <br />
              {c.who} range.
            </h2>
            <ol className="steps" style={{ fontSize: 13 }}>
              <li>
                <span className="mono">01</span>
                <span>
                  <b>Tu likes sur Spotify</b>, comme d&apos;habitude.
                </span>
              </li>
              <li>
                <span className="mono">02</span>
                <span>
                  <b>{c.who} imagine tes bacs</b> à partir de tes likes.
                </span>
              </li>
            </ol>
            <div className="grow" />
            <span className="btn btn--accent" style={{ display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>
              Entrer avec Spotify
            </span>
          </div>
        )}
      </Row>

      <Row title="04 · Notification du lundi">
        {(c) => (
          <div style={{ background: WALLPAPER, borderRadius: 18, padding: 12 }}>
            <div
              style={{
                background: "rgba(245, 245, 245, 0.82)",
                color: "#111",
                borderRadius: 16,
                padding: "10px 12px",
                display: "grid",
                gridTemplateColumns: "34px 1fr",
                gap: 10,
                fontFamily: "system-ui",
                fontSize: 13,
                lineHeight: 1.3,
              }}
            >
              <AppIcon name={c.name} size={34} />
              <span>
                <span style={{ display: "flex", justifyContent: "space-between" }}>
                  <b>{c.name}</b>
                  <span style={{ color: "#666" }}>lun. 08:00</span>
                </span>
                {c.who} a rangé tes 23 likes de la semaine dans 6 bacs. 3 attendent ton avis.
              </span>
            </div>
          </div>
        )}
      </Row>

      <Row title="05 · Sa voix dans l'app">
        {(c) => (
          <ul className="panel" style={{ margin: 0, listStyle: "none", fontSize: 14, lineHeight: 1.35 }}>
            <li>
              <span className="label muted">Accueil</span>
              <br />
              {c.who} est passé lundi : 23 likes rangés.
            </li>
            <li>
              <span className="label muted">Divers</span>
              <br />
              {c.who} hésite sur 12 titres. À toi de trancher.
            </li>
            <li>
              <span className="label muted">Potes</span>
              <br />
              {c.who} a fouillé chez Le G 87 : 8 titres pour toi.
            </li>
            <li>
              <span className="label muted">Invitation (texto)</span>
              <br />
              Viens sur {c.name}, il range tes likes Spotify tout seul.
            </li>
          </ul>
        )}
      </Row>
    </main>
  );
}
