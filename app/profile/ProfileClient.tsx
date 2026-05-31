"use client";

export type DnaSegment = { id: string; label: string; pct: number; color: string; count: number };
export type VibeCard = { name: string; trackCount: number; desc: string; color: string; bg: string; artists: string[] };
export type PatternData = { icon: string; title: string; sub: string; val: string };
export type EvoSeries = { name: string; color: string; vals: number[] };
export type DiscoveryRow = {
  title: string;
  artist: string;
  plName: string;
  plColor: string;
  plBg: string;
  init: string;
};

export interface ProfileClientProps {
  firstName: string;
  userImage: string | null;
  totalTracks: number;
  playlistCount: number;
  dnaSegments: DnaSegment[];
  vibes: VibeCard[];
  heat: number[][];
  patterns: PatternData[];
  evoSeries: EvoSeries[];
  evoLabels: string[];
  discoveries: DiscoveryRow[];
}

function EmptyState({ text }: { text: string }) {
  return (
    <div style={{
      borderRadius: 12,
      border: "1px dashed rgba(255,255,255,0.1)",
      padding: "20px 16px",
      textAlign: "center",
      color: "var(--ink-dimmer)",
      fontSize: 13,
      lineHeight: 1.5,
    }}>
      {text}
    </div>
  );
}

const HEAT_COLORS = ["var(--surface3)", "#3d3028", "#7a5435", "var(--terra)"];
const SLOT_LABELS = ["Mat.", "Apr.", "Soir", "Nuit"];
const DAY_LABELS = ["L", "M", "M", "J", "V", "S", "D"];

function buildSvgPath(vals: number[], W: number, H: number): string {
  if (vals.length < 2) return "";
  const pts = vals.map((v, i) => [
    (i / (vals.length - 1)) * W,
    H - (v / 100) * H * 0.85 - H * 0.05,
  ]);
  const step = W / (vals.length - 1);
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [px, py] = pts[i - 1], [cx, cy] = pts[i];
    d += ` C${px + step / 2},${py} ${cx - step / 2},${cy} ${cx},${cy}`;
  }
  return d;
}

export default function ProfileClient({
  firstName,
  userImage,
  totalTracks,
  playlistCount,
  dnaSegments,
  vibes,
  heat,
  patterns,
  evoSeries,
  evoLabels,
  discoveries,
}: ProfileClientProps) {
  return (
    <main className="s-page" style={{ paddingBottom: 88 }}>

      {/* ── Hero ── */}
      <div style={{ padding: "8px 0 28px" }}>
        <div>
          <div style={{ fontSize: 11, color: "var(--ink-dimmer)", letterSpacing: ".07em", textTransform: "uppercase", marginBottom: 6 }}>
            Sonic portrait
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
            {userImage && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={userImage} width={40} height={40} style={{ borderRadius: "50%", flexShrink: 0 }} alt="" />
            )}
            <h1 className="font-fraunces" style={{ fontSize: 42, fontWeight: 700, lineHeight: 1, color: "var(--ink)", margin: 0 }}>
              {firstName}
            </h1>
          </div>
          <p style={{ fontSize: 13, color: "var(--ink-dim)", marginBottom: 20 }}>
            {totalTracks} titre{totalTracks !== 1 ? "s" : ""} · {playlistCount} vibe{playlistCount !== 1 ? "s" : ""}
          </p>
          <div style={{ background: "rgba(200,122,82,.07)", border: "1px solid rgba(200,122,82,.25)", borderRadius: 14, padding: "14px 16px" }}>
            <div style={{ fontSize: 10, color: "var(--ink-dimmer)", letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 6 }}>
              Ta signature sonore
            </div>
            <div className="font-fraunces" style={{ fontStyle: "italic", fontSize: 16, color: "var(--terra)", lineHeight: 1.5 }}>
              {totalTracks === 0
                ? "Classe tes premiers titres pour générer ta signature."
                : `Un explorateur du groove — ${dnaSegments[0]?.label ?? "musique"} et au-delà, avec une âme qui ne s'éteint pas.`}
            </div>
          </div>
        </div>
      </div>

      {/* ── DNA Bar ── */}
      <section style={{ marginBottom: 28 }}>
        <div className="s-section-title">ADN musical</div>
        {dnaSegments.length > 0 ? (
          <>
            <div style={{ display: "flex", borderRadius: 10, overflow: "hidden", height: 36, gap: 2 }}>
              {dnaSegments.map(seg => (
                <div
                  key={seg.label}
                  style={{ flex: seg.pct, background: seg.color, display: "flex", alignItems: "center", justifyContent: "center", minWidth: 0 }}
                  title={`${seg.label} ${seg.pct}%`}
                >
                  {seg.pct >= 12 && (
                    <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,.8)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", padding: "0 8px" }}>
                      {seg.label}
                    </span>
                  )}
                </div>
              ))}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 14px", marginTop: 12 }}>
              {dnaSegments.map(seg => (
                <div key={seg.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: seg.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, color: "var(--ink-mid)" }}>{seg.label}</span>
                  <span style={{ fontSize: 12, color: "var(--ink-dim)" }}>{seg.pct}%</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <EmptyState text="Classe des titres pour voir ta répartition musicale" />
        )}
      </section>

      {/* ── Vibes Grid ── */}
      <section style={{ marginBottom: 28 }}>
        <div className="s-section-title">Vibes dominantes</div>
        {vibes.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {vibes.map(v => (
              <div
                key={v.name}
                style={{
                  borderRadius: 16, padding: "16px 14px", position: "relative", overflow: "hidden",
                  background: v.bg, border: `1px solid ${v.color}55`,
                }}
              >
                <div className="font-fraunces" style={{ fontStyle: "italic", fontSize: 36, fontWeight: 700, lineHeight: 1, marginBottom: 4, color: v.color }}>
                  {v.trackCount}
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,.7)", marginBottom: 2 }}>{v.name}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,.4)", lineHeight: 1.4, marginBottom: v.artists.length ? 10 : 0 }}>{v.desc}</div>
                {v.artists.length > 0 && (
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {v.artists.map(a => (
                      <span key={a} style={{ fontSize: 10, padding: "2px 7px", borderRadius: 99, background: "rgba(255,255,255,.08)", color: "rgba(255,255,255,.5)" }}>
                        {a}
                      </span>
                    ))}
                  </div>
                )}
                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, background: v.color }} />
              </div>
            ))}
          </div>
        ) : (
          <EmptyState text="Tes vibes apparaîtront une fois des titres assignés à tes playlists" />
        )}
      </section>

      {/* ── Heatmap ── */}
      <section style={{ marginBottom: 28 }}>
        <div className="s-section-title">Quand tu écoutes</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, marginTop: 4 }}>
          {DAY_LABELS.map((day, i) => (
            <div key={`${day}-${i}`} style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "center" }}>
              <div style={{ fontSize: 10, color: "var(--ink-dimmer)", marginBottom: 2, textAlign: "center" }}>{day}</div>
              {(heat[i] ?? [0, 0, 0, 0]).map((intensity, j) => (
                <div
                  key={j}
                  title={`${day} ${SLOT_LABELS[j]}`}
                  style={{ width: "100%", aspectRatio: "1", borderRadius: 4, background: HEAT_COLORS[Math.min(intensity, 3)] }}
                />
              ))}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, justifyContent: "flex-end" }}>
          <span style={{ fontSize: 11, color: "var(--ink-dimmer)" }}>Moins</span>
          <div style={{ display: "flex", gap: 3 }}>
            {HEAT_COLORS.map((c, i) => (
              <div key={i} style={{ width: 12, height: 12, borderRadius: 3, background: c }} />
            ))}
          </div>
          <span style={{ fontSize: 11, color: "var(--ink-dimmer)" }}>Plus</span>
        </div>
      </section>

      {/* ── Patterns ── */}
      <section style={{ marginBottom: 28 }}>
        <div className="s-section-title">Habitudes d'écoute</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {patterns.map((p, i) => (
            <div
              key={i}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                background: "var(--surface)", border: "1px solid var(--surface3)",
                borderLeft: "3px solid var(--terra)", borderRadius: 12, padding: "12px 14px",
              }}
            >
              <div style={{ fontSize: 20, flexShrink: 0, width: 32, textAlign: "center" }}>{p.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)", marginBottom: 2 }}>{p.title}</div>
                <div style={{ fontSize: 11, color: "var(--ink-dim)" }}>{p.sub}</div>
              </div>
              <div className="font-fraunces" style={{ fontStyle: "italic", fontSize: 18, color: "var(--terra)", flexShrink: 0 }}>
                {p.val}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Taste Evolution ── */}
      <section style={{ marginBottom: 28 }}>
        <div className="s-section-title">Évolution du goût · 6 mois</div>
        {evoSeries.length > 0 && evoLabels.length >= 2 ? (
          <>
            <div style={{ position: "relative", height: 80, marginTop: 4 }}>
              <svg viewBox="0 0 360 80" preserveAspectRatio="none" style={{ width: "100%", height: 80 }}>
                {evoSeries.map(series => {
                  const d = buildSvgPath(series.vals, 360, 80);
                  return d ? (
                    <path key={series.name} d={d} fill="none" stroke={series.color} strokeWidth="2" opacity="0.8" />
                  ) : null;
                })}
              </svg>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
              {evoLabels.map((lbl, i) => (
                <span key={i} style={{ fontSize: 10, color: "var(--ink-dimmer)" }}>{lbl}</span>
              ))}
            </div>
            <div style={{ display: "flex", gap: 14, marginTop: 8, flexWrap: "wrap" }}>
              {evoSeries.map(s => (
                <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <div style={{ width: 20, height: 2, background: s.color, borderRadius: 1 }} />
                  <span style={{ fontSize: 11, color: "var(--ink-mid)" }}>{s.name}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <EmptyState text="Besoin de 2 mois de données pour tracer l'évolution" />
        )}
      </section>

      {/* ── Discoveries ── */}
      <section style={{ marginBottom: 28 }}>
        <div className="s-section-title">Découvertes récentes</div>
        {discoveries.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 1, borderRadius: 14, overflow: "hidden", border: "1px solid var(--surface3)" }}>
            {discoveries.map((d, i) => (
              <div
                key={i}
                style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "11px 14px",
                  background: "var(--surface)", borderLeft: `3px solid ${d.plColor}88`,
                }}
              >
                <div className="font-fraunces" style={{ fontStyle: "italic", fontSize: 18, color: "var(--ink-dimmer)", width: 22, flexShrink: 0, textAlign: "center" }}>
                  {i + 1}
                </div>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: `${d.plColor}22`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 600, color: d.plColor, flexShrink: 0 }}>
                  {d.init}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.title}</div>
                  <div style={{ fontSize: 11, color: "var(--ink-dim)" }}>{d.artist}</div>
                </div>
                <div style={{ fontSize: 10, padding: "2px 8px", borderRadius: 99, background: d.plBg, color: d.plColor, border: `1px solid ${d.plColor}44`, flexShrink: 0, whiteSpace: "nowrap" }}>
                  {d.plName}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState text="Tes titres récemment classifiés apparaîtront ici" />
        )}
      </section>

      {/* ── Share ── */}
      <section style={{ marginBottom: 8 }}>
        <button
          style={{
            width: "100%", padding: 14, borderRadius: 14, background: "var(--surface)",
            border: "1px solid var(--surface3)", fontSize: 14, fontWeight: 600,
            color: "var(--ink-dim)", fontFamily: "inherit", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
          Partager mon sonic portrait
        </button>
      </section>

    </main>
  );
}
