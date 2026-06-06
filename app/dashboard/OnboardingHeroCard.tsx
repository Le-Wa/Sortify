"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";

interface StatusPayload {
  pct: number;
  step: string;
  imported: number;
  enriched: number;
  classified: number;
  import_count: number;
  enrich_count: number;
  enrich_total: number;
  classify_count: number;
  onboarding_status: string;
  proposal_ready?: boolean;
}

interface Props {
  initialStatus: string;
  initialMode: string | null;
  initialStep: number;
  initialProposalReady: boolean;
  hasPlaylists: boolean;
}

const PERIOD_OPTIONS = [
  { label: "6 derniers mois", value: 6 },
  { label: "1 an", value: 12 },
  { label: "3 ans", value: 36 },
  { label: "Depuis le début", value: null },
];

const VOLUME_OPTIONS = [
  { label: "~100 tracks", sublabel: "Rapide — environ 5 min", value: 100 },
  { label: "~300 tracks", sublabel: "Équilibré — environ 15 min", value: 300 },
  { label: "~500 tracks", sublabel: "Approfondi — environ 25 min", value: 500 },
  { label: "Tout", sublabel: "Complet — durée variable", value: null },
];

function StepIcon({ state }: { state: "done" | "active" | "waiting" }) {
  if (state === "done") {
    return (
      <span style={{ color: "var(--sage)", fontSize: 14, lineHeight: 1, flexShrink: 0 }}>✓</span>
    );
  }
  if (state === "active") {
    return (
      <span style={{
        display: "inline-block", width: 12, height: 12, borderRadius: "50%",
        border: "2px solid var(--terra)", borderTopColor: "transparent",
        flexShrink: 0,
        animation: "spin 0.8s linear infinite",
      }} />
    );
  }
  return (
    <span style={{
      display: "inline-block", width: 12, height: 12, borderRadius: "50%",
      border: "2px solid var(--ink-dimmer)", flexShrink: 0,
    }} />
  );
}

export default function OnboardingHeroCard({
  initialStatus,
  initialMode,
  initialStep,
  initialProposalReady,
  hasPlaylists,
}: Props) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [mode, setMode] = useState(initialMode);
  const [step, setStep] = useState(initialStep);
  const [proposalReady, setProposalReady] = useState(initialProposalReady);
  const [importCount, setImportCount] = useState(0);
  const [enrichCount, setEnrichCount] = useState(0);
  const [enrichTotal, setEnrichTotal] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [period, setPeriod] = useState<number | null>(12);
  const [volume, setVolume] = useState<number | null>(300);
  const [launching, setLaunching] = useState(false);
  const [settingManual, setSettingManual] = useState(false);

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const classifyRunning = useRef(false);
  const redirected = useRef(false);

  const goToDashboard = useCallback(() => {
    if (redirected.current) return;
    redirected.current = true;
    router.refresh();
  }, [router]);

  // drive job + polling quand le job tourne en mode auto
  useEffect(() => {
    const isRunning = status === "in_progress" && mode === "auto" && !proposalReady;
    if (!isRunning) return;

    let stopped = false;
    const jobRunning = { current: false };

    async function driveJob() {
      if (jobRunning.current) return;
      jobRunning.current = true;
      while (!stopped) {
        try {
          const res = await fetch("/api/onboarding/jobs/start", { method: "POST" });
          const data = await res.json() as { done?: boolean; proposalReady?: boolean; error?: string };
          if (data.proposalReady) { setProposalReady(true); break; }
          if (data.done) { goToDashboard(); break; }
          if (data.error || stopped) break;
        } catch {
          await new Promise(r => setTimeout(r, 5000));
        }
      }
      jobRunning.current = false;
    }

    driveJob();

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/onboarding/status");
        const data = (await res.json()) as StatusPayload;
        const stepNum = data.step === "import" ? 1 : data.step === "enrich" ? 2 : data.step === "classify" ? 3 : 4;
        setStep(stepNum);
        setImportCount(data.import_count ?? data.imported ?? 0);
        setEnrichCount(data.enrich_count ?? data.enriched ?? 0);
        setEnrichTotal(data.enrich_total ?? data.imported ?? 0);
        if (data.proposal_ready) { setProposalReady(true); clearInterval(pollRef.current!); return; }
        if (data.onboarding_status === "complete") { clearInterval(pollRef.current!); goToDashboard(); }
      } catch {}
    }, 20_000);

    return () => {
      stopped = true;
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [status, mode, proposalReady, goToDashboard]);

  // Step 3 classify loop
  useEffect(() => {
    if (mode !== "auto" || step !== 3 || proposalReady || classifyRunning.current) return;
    classifyRunning.current = true;
    (async () => {
      while (true) {
        try {
          await fetch("/api/classify/run", { method: "POST" });
          const res = await fetch("/api/onboarding/status");
          const data = (await res.json()) as StatusPayload;
          if (data.onboarding_status === "complete") { goToDashboard(); break; }
          await new Promise(r => setTimeout(r, 5000));
        } catch {
          await new Promise(r => setTimeout(r, 5000));
        }
      }
    })();
  }, [mode, step, proposalReady, goToDashboard]);

  if (status === "complete") return null;

  // ── Mode manual ─────────────────────────────────────────────────────────────
  if (mode === "manual") {
    if (hasPlaylists) return null;
    return (
      <div style={{ fontSize: 13, color: "var(--ink-dim)", marginBottom: 24 }}>
        Commence par importer tes playlists ou en créer une nouvelle.
      </div>
    );
  }

  // ── Mode auto — progression ─────────────────────────────────────────────────
  if (mode === "auto") {
    if (proposalReady) {
      return (
        <div className="s-card" style={{ marginBottom: 24, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontWeight: 600, color: "var(--ink)", fontSize: 16 }}>Ton analyse est prête.</div>
          <div style={{ fontSize: 13, color: "var(--ink-dim)" }}>
            Sortify a analysé ta bibliothèque et te propose une organisation.
          </div>
          <a href="/onboarding/propose" className="s-btn s-btn-primary" style={{ textDecoration: "none", alignSelf: "flex-start" }}>
            Voir ma proposition →
          </a>
        </div>
      );
    }

    // A2 — 3 steps simultanés avec leur état
    const stepItems = [
      {
        label: "Import",
        state: (step > 1 ? "done" : step === 1 ? "active" : "waiting") as "done" | "active" | "waiting",
        counter: importCount > 0 ? `${importCount} tracks récupérées` : null,
      },
      {
        label: "Enrichissement",
        state: (step > 2 ? "done" : step === 2 ? "active" : "waiting") as "done" | "active" | "waiting",
        counter: step >= 2 && enrichTotal > 0 ? `${enrichCount} / ${enrichTotal} analysées` : null,
      },
      {
        label: "Classification",
        state: (step > 3 ? "done" : step === 3 ? "active" : "waiting") as "done" | "active" | "waiting",
        counter: null,
      },
    ];

    return (
      <div className="s-card" style={{ marginBottom: 24, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-mid)" }}>Analyse en cours…</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {stepItems.map((s) => (
            <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <StepIcon state={s.state} />
              <span style={{
                fontSize: 13,
                color: s.state === "done" ? "var(--ink-dim)" : s.state === "active" ? "var(--ink)" : "var(--ink-dimmer)",
                fontWeight: s.state === "active" ? 500 : 400,
                flex: 1,
              }}>
                {s.label}
              </span>
              {s.counter && (
                <span style={{ fontSize: 12, color: "var(--ink-dim)" }}>{s.counter}</span>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Mode null — orientation (A1) ────────────────────────────────────────────
  return (
    <>
      <div className="s-card" style={{ marginBottom: 24, display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ fontWeight: 600, color: "var(--ink)", fontSize: 17, fontFamily: "var(--font-fraunces), serif" }}>
          Bienvenue — configurons ton Sortify.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {/* Carte Auto */}
          <div style={{
            background: "var(--surface2)", border: "1px solid var(--border-strong)",
            borderRadius: 10, padding: "16px 18px",
            display: "flex", flexDirection: "column", gap: 10,
          }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: "var(--ink)" }}>Analyse automatique</div>
            <div style={{ fontSize: 13, color: "var(--ink-dim)", lineHeight: 1.6 }}>
              Sortify importe un échantillon de ta bibliothèque, analyse les genres et te propose une
              organisation en playlists. Tu valides, ajustes, puis le tri démarre.
            </div>
            <button
              className="s-btn s-btn-primary s-btn-sm"
              style={{ alignSelf: "flex-start" }}
              onClick={() => setDrawerOpen(true)}
            >
              Analyser ma bibliothèque →
            </button>
          </div>

          {/* Carte Manuel */}
          <div style={{
            background: "var(--surface2)", border: "1px solid var(--border)",
            borderRadius: 10, padding: "16px 18px",
            display: "flex", flexDirection: "column", gap: 10,
          }}>
            <div style={{ fontWeight: 600, fontSize: 14, color: "var(--ink)" }}>Configuration manuelle</div>
            <div style={{ fontSize: 13, color: "var(--ink-dim)", lineHeight: 1.6 }}>
              Importe tes playlists Spotify existantes ou crée tes propres playlists avec tes artistes
              de référence. Sortify apprend ton organisation et classe tes prochains likes automatiquement.
            </div>
            <button
              className="s-btn s-btn-sm"
              style={{ alignSelf: "flex-start" }}
              disabled={settingManual}
              onClick={async () => {
                setSettingManual(true);
                await fetch("/api/users/onboarding", {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ mode: "manual" }),
                }).catch(() => {});
                router.push("/playlists");
              }}
            >
              Configurer moi-même →
            </button>
          </div>
        </div>
      </div>

      {/* Drawer configuration analyse */}
      {drawerOpen && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 300,
          background: "rgba(0,0,0,0.5)",
          display: "flex", alignItems: "flex-end",
        }} onClick={() => setDrawerOpen(false)}>
          <div
            className="s-card"
            onClick={e => e.stopPropagation()}
            style={{
              width: "100%", maxWidth: 520, margin: "0 auto",
              borderRadius: "16px 16px 0 0",
              display: "flex", flexDirection: "column",
              maxHeight: "85vh",
            }}
          >
            <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20, overflowY: "auto", flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 17, color: "var(--ink)" }}>Configuration de l'analyse</div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-dim)" }}>Période</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {PERIOD_OPTIONS.map(opt => (
                    <button
                      key={String(opt.value)}
                      className="s-btn s-btn-sm"
                      onClick={() => setPeriod(opt.value)}
                      style={{
                        background: period === opt.value ? "var(--terra)" : undefined,
                        color: period === opt.value ? "#fff" : undefined,
                        borderColor: period === opt.value ? "var(--terra)" : undefined,
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-dim)" }}>Volume</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {VOLUME_OPTIONS.map(opt => (
                    <button
                      key={String(opt.value)}
                      className="s-btn s-btn-sm"
                      onClick={() => setVolume(opt.value)}
                      style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: "10px 14px", textAlign: "left",
                        background: volume === opt.value ? "rgba(200,122,82,.15)" : undefined,
                        borderColor: volume === opt.value ? "var(--terra)" : undefined,
                      }}
                    >
                      <span style={{ fontWeight: 500, fontSize: 13 }}>{opt.label}</span>
                      <span style={{ fontSize: 12, color: "var(--ink-dim)" }}>{opt.sublabel}</span>
                    </button>
                  ))}
                </div>
              </div>

              <p style={{ fontSize: 12, color: "var(--ink-dim)", margin: 0 }}>
                La proposition de playlists apparaîtra dans l'app une fois l'analyse terminée.
              </p>
            </div>

            <div style={{ padding: "12px 24px 24px", borderTop: "1px solid var(--border)" }}>
              <button
                className="s-btn s-btn-primary"
                style={{ width: "100%" }}
                disabled={launching}
                onClick={async () => {
                  setLaunching(true);
                  await fetch("/api/onboarding/start-analyse", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ sample_size: volume, period_months: period }),
                  }).catch(() => {});
                  setMode("auto");
                  setStatus("in_progress");
                  setStep(1);
                  setDrawerOpen(false);
                  setLaunching(false);
                }}
              >
                {launching ? "Lancement…" : "Analyser"}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
