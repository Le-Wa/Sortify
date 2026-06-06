import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getUserOnboarding } from "@/lib/supabase/queries";
import SpotifySignInButton from "@/app/ui/SpotifySignInButton";

const ACCENT = "#c6925a";
const SPOTIFY_GREEN = "#1DB954";

const DEMO_TRACKS = [
  { title: "Runaway", artist: "AURORA", playlist: "Late Night Drive", color: "#c6925a" },
  { title: "Get Lucky", artist: "Daft Punk", playlist: "Workout", color: "#c4a440" },
  { title: "No Ordinary Love", artist: "Sade", playlist: "Jazz & Soul", color: "#c4758a" },
];

const FEATURES = [
  {
    title: "Tri automatique",
    desc: "Tes nouveaux likes sont analysés et rangés dans la bonne playlist — sans que tu n'aies rien à faire.",
    colors: {
      fg: "#c6925a",
      iconBg: "rgba(198,146,90,0.15)",
      iconBorder: "rgba(198,146,90,0.30)",
      cardBg: "rgba(198,146,90,0.06)",
      cardBorder: "rgba(198,146,90,0.18)",
    },
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 22, height: 22 }}>
        <path d="M3 7h18M7 12h10M11 17h2" strokeLinecap="round" />
        <path d="M17 4l3 3-3 3M7 17L4 20l3 3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: "Classifieur intelligent",
    desc: "Genres, tempo, énergie — Sortify comprend le mood de chaque track et sait exactement où elle a sa place.",
    colors: {
      fg: "#6a9070",
      iconBg: "rgba(106,144,112,0.15)",
      iconBorder: "rgba(106,144,112,0.28)",
      cardBg: "rgba(106,144,112,0.06)",
      cardBorder: "rgba(106,144,112,0.18)",
    },
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 22, height: 22 }}>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3M5.64 5.64l2.12 2.12M16.24 16.24l2.12 2.12M5.64 18.36l2.12-2.12M16.24 7.76l2.12-2.12" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "Tes règles, ta logique",
    desc: "Configure tes playlists avec quelques mots. Sortify apprend et s'adapte à ta façon d'écouter.",
    colors: {
      fg: "#c89840",
      iconBg: "rgba(200,152,64,0.14)",
      iconBorder: "rgba(200,152,64,0.28)",
      cardBg: "rgba(200,152,64,0.06)",
      cardBorder: "rgba(200,152,64,0.18)",
    },
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 22, height: 22 }}>
        <path d="M2 7h2m14 0h4M8 7a3 3 0 106 0 3 3 0 00-6 0zM2 17h8m6 0h4M14 17a3 3 0 10-6 0 3 3 0 006 0z" strokeLinecap="round" />
      </svg>
    ),
  },
];

const STEPS = [
  { label: "Connecte ton Spotify", note: null },
  { label: "Configure tes playlists cibles", note: null },
  { label: "Lance le premier tri", note: null },
  {
    label: "Sortify trie tout seul chaque semaine",
    note: "Tes playlists se remplissent, tu profites.",
  },
];

function SpotifyIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      style={{ width: size, height: size, fill: "currentColor", flexShrink: 0 }}
    >
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
    </svg>
  );
}

export default async function RootPage() {
  const session = await getServerSession(authOptions);
  if (session) {
    const dbUser = await getUserOnboarding(session.userId);
    if (!dbUser?.onboarding_completed) redirect("/onboarding");
    redirect("/dashboard");
  }

  return (
    <>
      <style>{`
        .lp-features-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }
        @keyframes lp-tag-appear {
          0%, 5%   { opacity: 0; transform: translateX(10px); }
          18%      { opacity: 1; transform: translateX(0); }
          74%      { opacity: 1; transform: translateX(0); }
          84%      { opacity: 0; }
          100%     { opacity: 0; }
        }
        .lp-demo-tag {
          opacity: 0;
          animation: lp-tag-appear 8s ease-out infinite;
        }
        .lp-demo-tag-0 { animation-delay: 0.4s; }
        .lp-demo-tag-1 { animation-delay: 1.1s; }
        .lp-demo-tag-2 { animation-delay: 1.8s; }
        @media (max-width: 640px) {
          .lp-features-grid { grid-template-columns: 1fr; }
          .lp-hero { padding: 52px 20px 36px !important; }
          .lp-hero-title { font-size: 36px !important; }
          .lp-logo-hero { font-size: 52px !important; }
          .lp-section { padding: 48px 20px !important; }
          .lp-nav { padding: 0 16px !important; }
          .lp-nav-btn span { display: none; }
          .lp-bottom-cta-title { font-size: 34px !important; }
          .lp-demo-tag { font-size: 10px !important; padding: 4px 8px !important; }
        }
      `}</style>

      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          background: "var(--bg)",
        }}
      >
        {/* ── Nav ── */}
        <header
          className="lp-nav"
          style={{
            position: "sticky",
            top: 0,
            zIndex: 10,
            background: "rgba(19,17,16,0.92)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 28px",
            height: 60,
          }}
        >
          <div
            className="font-fraunces"
            style={{
              fontStyle: "italic",
              fontWeight: 600,
              fontSize: 22,
              color: "var(--ink)",
              letterSpacing: "-0.3px",
            }}
          >
            Sortify<span style={{ color: ACCENT }}>.</span>
          </div>

          <SpotifySignInButton
            className="lp-nav-btn"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              border: "1px solid var(--border-strong)",
              borderRadius: 40,
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: 500,
              color: "var(--ink)",
              whiteSpace: "nowrap",
              background: "none",
            }}
          >
            <SpotifyIcon size={15} />
            <span>Connecter Spotify</span>
          </SpotifySignInButton>
        </header>

        <main style={{ flex: 1 }}>
          {/* ── Hero ── */}
          <section
            className="lp-hero"
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
              padding: "80px 24px 48px",
              maxWidth: 680,
              margin: "0 auto",
            }}
          >
            <div
              className="font-fraunces lp-logo-hero"
              style={{
                fontStyle: "italic",
                fontWeight: 600,
                fontSize: 72,
                color: "var(--ink)",
                letterSpacing: "-0.02em",
                lineHeight: 1,
                marginBottom: 24,
              }}
            >
              Sortify<span style={{ color: ACCENT }}>.</span>
            </div>

            <h1
              className="lp-hero-title"
              style={{
                fontSize: "clamp(36px, 6vw, 56px)",
                fontWeight: 700,
                color: "var(--ink)",
                letterSpacing: "-0.03em",
                lineHeight: 1.1,
                marginBottom: 16,
              }}
            >
              Tes liked songs,
              <em style={{ fontStyle: "normal", color: ACCENT, display: "block" }}>enfin rangées</em>
            </h1>

            <p
              style={{
                fontSize: 16,
                color: "var(--ink-mid)",
                lineHeight: 1.65,
                maxWidth: 400,
                marginBottom: 36,
              }}
            >
              Connecte ton Spotify, décris tes playlists en deux mots —<br />
              Sortify fait le reste chaque semaine.
            </p>

            <SpotifySignInButton
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 10,
                background: SPOTIFY_GREEN,
                borderRadius: 40,
                padding: "13px 28px",
                fontSize: 15,
                fontWeight: 600,
                color: "#000",
                marginBottom: 14,
              }}
            >
              <SpotifyIcon />
              Commencer gratuitement
            </SpotifySignInButton>

            <p style={{ fontSize: 11, color: "var(--ink-dim)", letterSpacing: "0.02em" }}>
              Gratuit · Aucune carte requise · Fonctionne avec ton compte existant
            </p>
          </section>

          {/* ── Sort demo ── */}
          <div style={{ padding: "0 24px 72px", maxWidth: 540, margin: "0 auto" }}>
            <div
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border-strong)",
                borderRadius: 20,
                overflow: "hidden",
              }}
            >
              {/* Demo header */}
              <div
                style={{
                  padding: "11px 20px",
                  borderBottom: "1px solid var(--border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    fontSize: 12,
                    fontWeight: 600,
                    color: SPOTIFY_GREEN,
                  }}
                >
                  <SpotifyIcon size={13} />
                  Liked Songs
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 11,
                    color: "var(--ink-dim)",
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: "#4ade80",
                      display: "inline-block",
                      boxShadow: "0 0 5px #4ade8066",
                    }}
                  />
                  Tri en cours
                </div>
              </div>

              {/* Track rows */}
              {DEMO_TRACKS.map(({ title, artist, playlist, color }, i) => (
                <div
                  key={title}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 16,
                    padding: "14px 20px",
                    borderBottom:
                      i < DEMO_TRACKS.length - 1 ? "1px solid var(--border)" : "none",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: "var(--ink)",
                        letterSpacing: "-0.01em",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {title}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--ink-dim)", marginTop: 2 }}>
                      {artist}
                    </div>
                  </div>

                  <div
                    className={`lp-demo-tag lp-demo-tag-${i}`}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      padding: "5px 10px",
                      borderRadius: 20,
                      fontSize: 11,
                      fontWeight: 600,
                      background: `${color}18`,
                      border: `1px solid ${color}40`,
                      color,
                      flexShrink: 0,
                      whiteSpace: "nowrap",
                    }}
                  >
                    <span
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: "50%",
                        background: color,
                        flexShrink: 0,
                      }}
                    />
                    {playlist}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Features ── */}
          <section
            className="lp-section"
            style={{
              padding: "80px 24px",
              background: "var(--surface)",
              borderTop: "1px solid var(--border)",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <div style={{ maxWidth: 860, margin: "0 auto" }}>
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--ink-dim)",
                  textTransform: "uppercase",
                  letterSpacing: "0.14em",
                  textAlign: "center",
                  marginBottom: 48,
                }}
              >
                Ce que fait Sortify
              </p>

              <div className="lp-features-grid">
                {FEATURES.map(({ title, desc, icon, colors }) => (
                  <div
                    key={title}
                    style={{
                      background: colors.cardBg,
                      border: `1px solid ${colors.cardBorder}`,
                      borderRadius: 20,
                      padding: "28px 24px",
                    }}
                  >
                    <div
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: 14,
                        background: colors.iconBg,
                        border: `1px solid ${colors.iconBorder}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        marginBottom: 20,
                        color: colors.fg,
                      }}
                    >
                      {icon}
                    </div>
                    <h3
                      style={{
                        fontSize: 17,
                        fontWeight: 700,
                        color: "var(--ink)",
                        letterSpacing: "-0.02em",
                        marginBottom: 10,
                      }}
                    >
                      {title}
                    </h3>
                    <p
                      style={{
                        fontSize: 14,
                        color: "var(--ink-mid)",
                        lineHeight: 1.7,
                      }}
                    >
                      {desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── How it works ── */}
          <section className="lp-section" style={{ padding: "80px 24px" }}>
            <div style={{ maxWidth: 480, margin: "0 auto" }}>
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--ink-dim)",
                  textTransform: "uppercase",
                  letterSpacing: "0.14em",
                  textAlign: "center",
                  marginBottom: 48,
                }}
              >
                Comment ça marche
              </p>

              <div style={{ display: "flex", flexDirection: "column" }}>
                {STEPS.map(({ label, note }, i) => (
                  <div
                    key={i}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 20,
                      position: "relative",
                    }}
                  >
                    {i < STEPS.length - 1 && (
                      <div
                        style={{
                          position: "absolute",
                          left: 19,
                          top: 42,
                          width: 2,
                          height: 48,
                          background: `${ACCENT}25`,
                          borderRadius: 1,
                        }}
                      />
                    )}

                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: "50%",
                        border: `1.5px solid ${ACCENT}60`,
                        background: `${ACCENT}12`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 14,
                        fontWeight: 700,
                        color: ACCENT,
                        flexShrink: 0,
                        letterSpacing: "-0.02em",
                      }}
                    >
                      {i + 1}
                    </div>

                    <div
                      style={{
                        paddingTop: 8,
                        paddingBottom: i < STEPS.length - 1 ? 48 : 0,
                      }}
                    >
                      <p
                        style={{
                          fontSize: 17,
                          color: i === STEPS.length - 1 ? ACCENT : "var(--ink)",
                          fontWeight: 600,
                          lineHeight: 1.35,
                          letterSpacing: "-0.02em",
                        }}
                      >
                        {label}
                      </p>
                      {note && (
                        <p
                          style={{
                            fontSize: 13,
                            color: "var(--ink-dim)",
                            marginTop: 5,
                            fontWeight: 300,
                          }}
                        >
                          {note}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ── Bottom CTA ── */}
          <section
            className="lp-section"
            style={{
              padding: "88px 24px",
              textAlign: "center",
              borderTop: "1px solid var(--border)",
              background: "var(--surface)",
            }}
          >
            <div style={{ maxWidth: 520, margin: "0 auto" }}>
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--ink-dim)",
                  textTransform: "uppercase",
                  letterSpacing: "0.14em",
                  marginBottom: 20,
                }}
              >
                Prêt ?
              </p>
              <h2
                className="font-fraunces lp-bottom-cta-title"
                style={{
                  fontStyle: "italic",
                  fontWeight: 600,
                  fontSize: 48,
                  color: "var(--ink)",
                  letterSpacing: "-0.03em",
                  lineHeight: 1.1,
                  marginBottom: 16,
                }}
              >
                Range ta bibli,<br />
                <span style={{ color: ACCENT }}>une bonne fois.</span>
              </h2>
              <p
                style={{
                  fontSize: 15,
                  color: "var(--ink-mid)",
                  marginBottom: 32,
                  lineHeight: 1.65,
                }}
              >
                Connexion en 30 secondes, premier tri en quelques minutes.
              </p>
              <SpotifySignInButton
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10,
                  background: SPOTIFY_GREEN,
                  borderRadius: 40,
                  padding: "15px 32px",
                  fontSize: 16,
                  fontWeight: 700,
                  color: "#000",
                  letterSpacing: "-0.01em",
                }}
              >
                <SpotifyIcon size={20} />
                Commencer gratuitement
              </SpotifySignInButton>
            </div>
          </section>
        </main>

        {/* ── Footer ── */}
        <footer
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 8,
            padding: "18px 28px",
            borderTop: "1px solid var(--border)",
          }}
        >
          <div
            className="font-fraunces"
            style={{
              fontStyle: "italic",
              fontWeight: 600,
              fontSize: 15,
              color: "var(--ink-dim)",
              letterSpacing: "-0.2px",
            }}
          >
            Sortify<span style={{ color: ACCENT }}>.</span>
          </div>
          <p style={{ fontSize: 11, color: "var(--ink-dimmer)", letterSpacing: "0.01em" }}>
            Pas affilié à Spotify · Données non revendues
          </p>
        </footer>
      </div>
    </>
  );
}
