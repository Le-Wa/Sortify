import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getUserOnboarding } from "@/lib/supabase/queries";

const ACCENT = "#c8935a";
const SPOTIFY_GREEN = "#1DB954";
const SIGNIN_URL = "/api/auth/signin/spotify?callbackUrl=%2Fdashboard";

const PILLS = [
  { name: "Late Night Drive", color: "#c8935a" },
  { name: "Dark Club", color: "#4e8fa8" },
  { name: "Sunday Morning", color: "#7a9e5a" },
  { name: "Mediterranean Vibes", color: "#3d7a70" },
  { name: "Hip-Hop FR", color: "#7f77dd" },
  { name: "Peak Hours", color: "#b85c48" },
  { name: "Workout", color: "#c4a440" },
  { name: "Jazz & Soul", color: "#c4758a" },
];

const FEATURES = [
  {
    title: "Tri automatique",
    desc: "Tes nouveaux likes sont analysés et rangés dans la bonne playlist — sans que tu n'aies rien à faire.",
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 18, height: 18 }}>
        <path d="M2 4h12M5 8h6M8 12h0" strokeLinecap="round" />
        <path d="M11 6l3-2-3-2M5 14L2 12l3-2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    title: "Classifieur intelligent",
    desc: "Genres, tempo, énergie — Sortify comprend le mood de chaque track et sait exactement où elle a sa place.",
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 18, height: 18 }}>
        <circle cx="8" cy="8" r="5" />
        <path d="M8 5v3l2 2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    title: "Tes règles, ta logique",
    desc: "Configure tes playlists avec quelques mots. Sortify apprend et s'adapte à ta façon d'écouter.",
    icon: (
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ width: 18, height: 18 }}>
        <path d="M2 5h2m8 0h2M6 5a2 2 0 104 0 2 2 0 00-4 0zM2 11h6m4 0h2M10 11a2 2 0 10-4 0 2 2 0 004 0z" strokeLinecap="round" />
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
        @media (max-width: 640px) {
          .lp-features-grid { grid-template-columns: 1fr; }
          .lp-hero { padding: 52px 20px 40px !important; }
          .lp-hero-title { font-size: 28px !important; }
          .lp-logo-hero { font-size: 44px !important; }
          .lp-section { padding: 48px 20px !important; }
          .lp-nav { padding: 0 16px !important; }
          .lp-nav-btn span { display: none; }
          .lp-bottom-cta-title { font-size: 26px !important; }
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

          <a
            href={SIGNIN_URL}
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
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            <SpotifyIcon size={15} />
            <span>Connecter Spotify</span>
          </a>
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
              padding: "80px 24px 60px",
              maxWidth: 680,
              margin: "0 auto",
            }}
          >
            <div
              className="font-fraunces lp-logo-hero"
              style={{
                fontStyle: "italic",
                fontWeight: 600,
                fontSize: 56,
                color: "var(--ink)",
                letterSpacing: "-1.5px",
                lineHeight: 1,
                marginBottom: 20,
              }}
            >
              Sortify<span style={{ color: ACCENT }}>.</span>
            </div>

            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                background: `${ACCENT}18`,
                border: `1px solid ${ACCENT}35`,
                borderRadius: 40,
                padding: "5px 14px",
                fontSize: 12,
                fontWeight: 500,
                color: ACCENT,
                marginBottom: 20,
                letterSpacing: "0.03em",
              }}
            >
              ✦ Compagnon Spotify
            </div>

            <h1
              className="lp-hero-title"
              style={{
                fontSize: 38,
                fontWeight: 300,
                color: "var(--ink)",
                letterSpacing: "-0.6px",
                lineHeight: 1.2,
                marginBottom: 32,
              }}
            >
              T&apos;as liké.{" "}
              <em style={{ fontStyle: "normal", color: ACCENT }}>C&apos;est trié.</em>
            </h1>


            <a
              href={SIGNIN_URL}
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
                textDecoration: "none",
                marginBottom: 14,
              }}
            >
              <SpotifyIcon />
              Commencer gratuitement
            </a>

            <p style={{ fontSize: 11, color: "var(--ink-dim)", letterSpacing: "0.02em" }}>
              Gratuit · Aucune carte requise · Fonctionne avec ton compte existant
            </p>
          </section>

          {/* ── Playlist pills ── */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "center",
              gap: 8,
              padding: "0 24px 72px",
              maxWidth: 680,
              margin: "0 auto",
            }}
          >
            {PILLS.map(({ name, color }) => (
              <span
                key={name}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "7px 15px",
                  borderRadius: 40,
                  fontSize: 12,
                  fontWeight: 500,
                  background: `${color}18`,
                  border: `1px solid ${color}38`,
                  color,
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: "50%",
                    background: color,
                    flexShrink: 0,
                  }}
                />
                {name}
              </span>
            ))}
          </div>

          {/* ── Features ── */}
          <section
            className="lp-section"
            style={{
              padding: "64px 24px",
              background: "var(--surface)",
              borderTop: "1px solid var(--border)",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <div style={{ maxWidth: 800, margin: "0 auto" }}>
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  color: "var(--ink-dim)",
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                  textAlign: "center",
                  marginBottom: 36,
                }}
              >
                Ce que fait Sortify
              </p>

              <div className="lp-features-grid">
                {FEATURES.map(({ title, desc, icon }) => (
                  <div
                    key={title}
                    style={{
                      background: "var(--surface2)",
                      border: "1px solid var(--border)",
                      borderRadius: 16,
                      padding: "24px 20px",
                    }}
                  >
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 10,
                        background: `${ACCENT}18`,
                        border: `1px solid ${ACCENT}30`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        marginBottom: 18,
                        color: ACCENT,
                      }}
                    >
                      {icon}
                    </div>
                    <h3
                      style={{
                        fontSize: 14,
                        fontWeight: 500,
                        color: "var(--ink)",
                        marginBottom: 8,
                      }}
                    >
                      {title}
                    </h3>
                    <p
                      style={{
                        fontSize: 13,
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
          <section className="lp-section" style={{ padding: "64px 24px" }}>
            <div style={{ maxWidth: 420, margin: "0 auto" }}>
              <p
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  color: "var(--ink-dim)",
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                  textAlign: "center",
                  marginBottom: 40,
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
                      gap: 16,
                      position: "relative",
                    }}
                  >
                    {i < STEPS.length - 1 && (
                      <div
                        style={{
                          position: "absolute",
                          left: 17,
                          top: 38,
                          width: 2,
                          height: 44,
                          background: "var(--border-strong)",
                          borderRadius: 1,
                        }}
                      />
                    )}

                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: "50%",
                        border: `1px solid ${ACCENT}50`,
                        background: `${ACCENT}10`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 13,
                        fontWeight: 600,
                        color: ACCENT,
                        flexShrink: 0,
                      }}
                    >
                      {i + 1}
                    </div>

                    <div
                      style={{
                        paddingTop: 7,
                        paddingBottom: i < STEPS.length - 1 ? 44 : 0,
                      }}
                    >
                      <p
                        style={{
                          fontSize: 15,
                          color: "var(--ink)",
                          fontWeight: i === STEPS.length - 1 ? 500 : 300,
                          lineHeight: 1.4,
                        }}
                      >
                        {label}
                      </p>
                      {note && (
                        <p
                          style={{
                            fontSize: 12,
                            color: "var(--ink-dim)",
                            marginTop: 4,
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
              padding: "72px 24px",
              textAlign: "center",
              borderTop: "1px solid var(--border)",
              background: "var(--surface)",
            }}
          >
            <div style={{ maxWidth: 480, margin: "0 auto" }}>
              <h2
                className="font-fraunces lp-bottom-cta-title"
                style={{
                  fontStyle: "italic",
                  fontWeight: 600,
                  fontSize: 32,
                  color: "var(--ink)",
                  letterSpacing: "-0.5px",
                  lineHeight: 1.2,
                  marginBottom: 12,
                }}
              >
                Prêt à ranger ta bibli ?
              </h2>
              <p
                style={{
                  fontSize: 14,
                  color: "var(--ink-mid)",
                  marginBottom: 28,
                  lineHeight: 1.65,
                }}
              >
                Connexion en 30 secondes, premier tri en quelques minutes.
              </p>
              <a
                href={SIGNIN_URL}
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
                  textDecoration: "none",
                }}
              >
                <SpotifyIcon />
                Commencer gratuitement
              </a>
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
