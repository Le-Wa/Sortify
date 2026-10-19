"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import type { CreationBac } from "@/lib/creation";
import type { SleeveMark } from "@/lib/cover-shapes";
import { librarySize } from "@/lib/library-size";
import type { PlaylistCandidate, PlaylistChoice } from "@/lib/playlists-import";
import type { RevelationState } from "@/lib/revelation";
import { InvitationForm, InvitationIntro } from "../../invitation/InvitationForm";
import type { InvitationState } from "../../invitation/actions";
import { PowerForm, PowerIntro } from "../../power/PowerForm";
import { CreationScreen } from "../../revelation/CreationScreen";
import { PlaylistsScreen } from "../../revelation/PlaylistsScreen";
import { ProposalScreen, type ProposalBac } from "../../revelation/ProposalScreen";
import { RevelationSourceContext, type RevelationSource } from "../../revelation/source";
import { WaitScreen } from "../../revelation/WaitScreen";
import { ConnexionView } from "../../ui/ConnexionView";
import { WelcomeCard } from "../../ui/pedagogie/WelcomeCard";

// Démo de l'onboarding : les vrais écrans, nourris par une simulation (aucun appel à Spotify, à l'IA ni à la base).

export interface DemoTrack {
  track_id: string;
  title: string;
  artist: string;
  cover_url: string | null;
  isrc: string | null;
  liked_at: string;
}

export interface DemoData {
  redirectUri: string;
  tracks: DemoTrack[];
  bacs: { id: string; name: string; sleeve: string; color: string; mark: SleeveMark; pitch: string; axis: string; tracks: number[] }[];
}

type Screen = "connexion" | "invitation" | "power" | "spotify" | "revelation";
type Stage = "import" | "playlists" | "analyse" | "proposition" | "creation" | "done";

interface SimBac {
  id: string;
  name: string;
  sleeve: string;
  color: string;
  mark: SleeveMark;
  pitch: string;
  axis: string;
  kept: boolean;
  tracks: number[];
  fromPlaylist: string | null;
}

interface Sim {
  stage: Stage;
  startedAt: number;
  choices: PlaylistChoice[];
  bacs: SimBac[];
  creation: CreationBac[];
}

// Durées de la simulation (ms) : l'onboarding réel prend 8 à 15 min, la démo une petite minute.
const IMPORT_LIKES = 5000;
const IMPORT_ENRICH = 7000;
const ANALYSE = { playlists: 3000, fiches: 7000, rangement: 5000, complement: 2500, remplissage: 2500 } as const;
const PRESS = 1100;

// Messages repris des vrais écrans (app/page.tsx, app/power/page.tsx, app/invitation/actions.ts).
const NEED_CODE = "Première fois ici ? Il te faut un code d'invitation.";
const REFUSED = "Spotify a refusé la connexion. Si c'est ta première fois, la personne qui t'a invité doit d'abord ajouter ton compte Spotify à Sortify.";
const POWER_REFUSED = "Connexion annulée ou refusée par Spotify.";
const POWER_NEED_CODE = "Il te faut un code d'invitation pour entrer dans Sortify.";

const IDEAS = [
  { name: "Dimanche lent", pitch: "Les titres qui ne pressent personne : voix posées, tempos bas, le café qui refroidit." },
  { name: "Retour de soirée", pitch: "Ce qu'on écoute dans le taxi à 4 h : encore de l'énergie, déjà un peu de mélancolie." },
  { name: "Bureau en roue libre", pitch: "Du groove sans paroles envahissantes, pour avancer sans s'en rendre compte." },
];
const COLORS = ["#FF6A13", "#2448D8", "#FF9FCB", "#14A3A3", "#FFD23F", "#B9A8FF"];

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Horloge de la simulation (hors rendu : appelée seulement par `poll` et les actions). */
const now = () => Date.now();

function freshSim(data: DemoData): Sim {
  return {
    stage: "import",
    startedAt: now(),
    choices: [],
    bacs: data.bacs.map((b) => ({ ...b, kept: true, fromPlaylist: null })),
    creation: [],
  };
}

function candidates(data: DemoData): PlaylistCandidate[] {
  const cover = (i: number) => data.tracks[i % data.tracks.length]?.cover_url ?? null;
  return [
    { id: "demo-dimanche", name: "Sons du dimanche", image: cover(3), total: 48, liked: 31, broad: false, parts: [] },
    {
      id: "demo-vibes",
      name: "Good vibes",
      image: cover(11),
      total: 120,
      liked: 74,
      broad: true,
      parts: [
        { family: "electro", label: "Électro", count: 30 },
        { family: "soul", label: "Soul & R&B", count: 22 },
        { family: "pop", label: "Pop & rock", count: 12 },
      ],
    },
  ];
}

/** Indices des titres « repris » d'une playlist : un tirage fixe dans la bibliothèque. */
const pick = (n: number, count: number, seed: number) => Array.from({ length: count }, (_, i) => (seed * 37 + i * 7) % n);

export function Demo({ data }: { data: DemoData }) {
  const router = useRouter();
  const search = useSearchParams();
  const [screen, setScreen] = useState<Screen>("connexion");
  const [error, setError] = useState<string | undefined>();
  const [withPlaylists, setWithPlaylists] = useState(true);
  const [path, setPath] = useState<"normal" | "power">("normal");
  // L'état simulé vit dans une ref (`poll` et les actions le font avancer) ; `bump` en copie un instantané pour l'affichage.
  const sim = useRef<Sim | null>(null);
  const [view, setView] = useState<Sim | null>(null);
  const bump = useCallback(() => {
    const cur = sim.current;
    if (cur) setView({ ...cur, bacs: cur.bacs.map((b) => ({ ...b })), creation: [...cur.creation] });
  }, []);
  // Après la page Spotify simulée : on entre (`ok`) ou on revient avec une erreur.
  const afterSpotify = useRef<{ ok: boolean; back: Screen; error?: string }>({ ok: true, back: "connexion" });
  const N = data.tracks.length;

  const go = (next: Stage) => {
    const cur = sim.current!;
    cur.stage = next;
    cur.startedAt = now();
  };

  const source = useMemo<RevelationSource>(() => {
    const s = () => sim.current!;
    const find = (id: string) => s().bacs.find((b) => b.id === id);

    const poll = async (): Promise<RevelationState> => {
      const cur = s();
      const t = now() - cur.startedAt;
      if (cur.stage === "import") {
        if (t >= IMPORT_LIKES + IMPORT_ENRICH) {
          go(withPlaylists ? "playlists" : "analyse");
          return poll();
        }
        const likes = t < IMPORT_LIKES;
        const imported = likes ? Math.round((N * t) / IMPORT_LIKES) : N;
        const enriched = likes ? 0 : Math.round((N * (t - IMPORT_LIKES)) / IMPORT_ENRICH);
        const track = data.tracks[(likes ? imported : enriched) % N];
        return {
          stage: "import",
          status: "running",
          error: null,
          progress: {
            phase: likes ? "likes" : "enrich",
            mode: "recents",
            cursor: null,
            imported,
            enriched,
            capped: false,
            current: { title: track.title, artist: track.artist, cover: track.cover_url, liked_at: track.liked_at },
          },
        };
      }
      if (cur.stage === "playlists") return { stage: "playlists" };
      if (cur.stage === "analyse") {
        const phases = (Object.keys(ANALYSE) as (keyof typeof ANALYSE)[]).filter((p) => p !== "playlists" || cur.choices.length > 0);
        let rest = t;
        for (const phase of phases) {
          const d = ANALYSE[phase];
          if (rest < d) {
            const frac = rest / d;
            // Les vraies étapes avancent au temps écoulé (WaitScreen) : on recule leur début pour que la jauge suive.
            const real = { playlists: 40, fiches: 150, rangement: 1, complement: 60, remplissage: 60 }[phase];
            return {
              stage: "analyse",
              status: "running",
              error: null,
              covers: data.tracks.slice(0, 24).flatMap((x) => (x.cover_url ? [x.cover_url] : [])),
              progress: {
                phase,
                sorted: phase === "rangement" ? Math.round(N * frac) : 0,
                total: N,
                phaseStartedAt: new Date(now() - frac * real * 2000).toISOString(),
              },
            };
          }
          rest -= d;
        }
        go("proposition");
        return poll();
      }
      if (cur.stage === "proposition") return { stage: "proposition", filling: false, error: null };
      if (cur.stage === "creation") {
        const pressed = Math.floor(t / PRESS);
        const bacs = cur.creation.map((b, i) => ({
          ...b,
          done: i < pressed,
          added: i < pressed ? b.total : i === pressed ? Math.round((b.total * (t % PRESS)) / PRESS) : 0,
        }));
        if (pressed >= bacs.length) {
          cur.creation = bacs;
          go("done");
          return poll();
        }
        return { stage: "creation", status: "running", error: null, progress: { phase: "playlists", bacs } };
      }
      return { stage: "done", creation: { phase: "done", bacs: cur.creation } };
    };

    return {
      poll,
      advance: bump,
      homeHref: "/lab/onboarding?fin=1",
      actions: {
        async setKept(id, keep) {
          const b = find(id);
          if (!b) return { ok: false, message: "Bac introuvable." };
          b.kept = keep;
          bump();
          return { ok: true };
        },
        async renameBac(id, name) {
          const b = find(id);
          if (!b || !name.trim()) return { ok: false, message: "Donne un nom au bac." };
          b.name = b.sleeve = name.trim().slice(0, 40);
          bump();
          return { ok: true };
        },
        async otherIdea(id) {
          await wait(2500);
          const b = find(id);
          if (!b) return { ok: false, message: "Bac introuvable." };
          const idea = IDEAS.find((x) => !s().bacs.some((y) => y.name === x.name)) ?? IDEAS[0];
          Object.assign(b, { name: idea.name, sleeve: idea.name, pitch: idea.pitch });
          bump();
          return { ok: true };
        },
        async mergeBacs(firstId, secondId) {
          await wait(2500);
          const a = find(firstId);
          const b = find(secondId);
          if (!a || !b) return { ok: false, message: "Bac introuvable." };
          const name = `${a.name} & ${b.name}`.slice(0, 40);
          Object.assign(a, { name, sleeve: name, kept: true, tracks: [...new Set([...a.tracks, ...b.tracks])], pitch: `${a.pitch} ${b.pitch}` });
          s().bacs = s().bacs.filter((x) => x.id !== secondId);
          bump();
          return { ok: true };
        },
        async addCustomBac(request) {
          await wait(3000);
          const text = request.trim();
          if (text.length < 3) return { ok: false, message: "Décris le bac en quelques mots." };
          const name = (text[0].toUpperCase() + text.slice(1)).slice(0, 32);
          const i = s().bacs.length;
          s().bacs.push({
            id: `demo-custom-${now()}`,
            name,
            sleeve: name,
            color: COLORS[i % COLORS.length],
            mark: { shape: "sparkle", outline: false },
            pitch: `Ton bac sur mesure : « ${text} ».`,
            axis: "transversal",
            kept: true,
            tracks: pick(N, 18, i),
            fromPlaylist: null,
          });
          bump();
          return { ok: true };
        },
        async createBacs() {
          const kept = s().bacs.filter((b) => b.kept);
          if (kept.length === 0) return { ok: false, message: "Garde au moins un bac." };
          const inBac = new Set(kept.flatMap((b) => b.tracks));
          s().creation = [
            ...kept.map((b, i) => ({ id: b.id, name: b.name, sleeve: b.sleeve, mark: b.mark, color: b.color, position: i, is_divers: false, total: b.tracks.length, added: 0, done: false })),
            {
              id: "demo-divers",
              name: "Divers",
              sleeve: "Divers",
              mark: { shape: "asterisk", outline: false },
              color: "#8e8f89",
              position: kept.length,
              is_divers: true,
              total: N - inBac.size,
              added: 0,
              done: false,
            },
          ];
          go("creation");
          return { ok: true };
        },
        async savePlaylists(choices) {
          await wait(600);
          const list = choices as PlaylistChoice[];
          s().choices = list;
          for (const c of list) {
            const cand = candidates(data).find((x) => x.id === c.id);
            if (!cand || c.mode === "indice") continue;
            const parts = c.mode === "split" ? cand.parts.map((p) => ({ name: p.label, count: p.count })) : [{ name: cand.name, count: cand.liked }];
            for (const p of parts) {
              const i = s().bacs.length;
              s().bacs.unshift({
                id: `demo-pl-${c.id}-${i}`,
                name: p.name,
                sleeve: p.name,
                color: COLORS[i % COLORS.length],
                mark: { shape: "waves", outline: false },
                pitch: `Repris de ta playlist « ${cand.name} » : ses titres likés, et ceux de ta bibliothèque qui lui ressemblent.`,
                axis: "scène",
                kept: true,
                tracks: pick(N, p.count, i + 3),
                fromPlaylist: cand.name,
              });
            }
          }
          go("analyse");
          return { ok: true };
        },
      },
    };
    // `withPlaylists` est lu au moment où l'import se termine.
  }, [data, N, bump, withPlaylists]);

  function restart() {
    sim.current = null;
    setView(null);
    setError(undefined);
    setScreen("connexion");
    router.replace("/lab/onboarding");
  }

  function toSpotify(ok: boolean, back: Screen, err?: string) {
    afterSpotify.current = { ok, back, error: err };
    setError(undefined);
    setScreen("spotify");
  }

  const fin = search.get("fin") === "1";
  let body: React.ReactNode;
  if (fin) {
    body = (
      <main className="page page--bare">
        <WelcomeCard nextTri="lundi vers 08:00" onClose={restart} />
        <p className="small muted" style={{ margin: 0 }}>
          Fin de la démo : sur la vraie app, cette bienvenue s&apos;affiche une seule fois en haut de l&apos;Accueil.
        </p>
        <button type="button" className="btn" onClick={restart}>
          Recommencer
        </button>
      </main>
    );
  } else if (screen === "connexion") {
    body = (
      <ConnexionView
        error={error}
        primary={
          <button type="button" className="btn" onClick={() => toSpotify(false, "connexion", NEED_CODE)}>
            Se connecter avec Spotify
          </button>
        }
        onNavigate={(target) => {
          setError(undefined);
          setPath(target === "power" ? "power" : "normal");
          setScreen(target);
        }}
      />
    );
  } else if (screen === "invitation") {
    body = (
      <main className="page page--bare">
        <button type="button" className="back link-btn" onClick={() => setScreen("connexion")}>
          ‹ Connexion
        </button>
        <InvitationIntro />
        <InvitationForm check={demoCheck} onReady={() => toSpotify(true, "connexion")} />
      </main>
    );
  } else if (screen === "power") {
    body = (
      <main className="page page--bare">
        <button type="button" className="back link-btn" onClick={() => setScreen("connexion")}>
          ‹ Connexion
        </button>
        <PowerIntro redirectUri={data.redirectUri} />
        {error ? (
          <p className="notice notice--error" role="alert">
            {error}
          </p>
        ) : null}
        <PowerForm
          submit={async (input) => {
            await wait(800);
            if (!/^[0-9a-f]{32}$/i.test(input.clientId.trim())) return { ok: false, message: "Le Client ID fait 32 caractères (chiffres et lettres a à f)." };
            if (!/^[0-9a-f]{32}$/i.test(input.clientSecret.trim())) return { ok: false, message: "Le Client Secret fait 32 caractères (chiffres et lettres a à f)." };
            if (input.anthropicKey.trim() && !input.anthropicKey.trim().startsWith("sk-ant-")) return { ok: false, message: "Cette clé Anthropic ne marche pas (elle commence par sk-ant-)." };
            return { ok: true, url: input.code.trim() ? "ok" : "sans-code" };
          }}
          onSuccess={(url) => toSpotify(url === "ok", "power", url === "ok" ? undefined : POWER_NEED_CODE)}
        />
      </main>
    );
  } else if (screen === "spotify") {
    body = (
      <main className="page page--bare">
        <span className="label">Écran Spotify · simulé</span>
        <h1 className="display" style={{ fontSize: 40 }}>
          Sortify veut accéder à ton compte
        </h1>
        <p className="muted" style={{ margin: 0 }}>
          {path === "power" ? "Via ton app Spotify à toi." : "Via l'app Spotify de Sortify."} Sortify pourra :
        </p>
        <ul className="small stack" style={{ gap: 6, paddingLeft: 18, margin: 0 }}>
          <li>voir tes titres likés et tes playlists ;</li>
          <li>créer et modifier des playlists, et leur mettre une pochette ;</li>
          <li>voir ton nom et ton adresse e-mail.</li>
        </ul>
        <div className="grow" />
        <button
          type="button"
          className="btn"
          onClick={() => {
            const a = afterSpotify.current;
            if (!a.ok) {
              setError(a.error);
              setScreen(a.back);
              return;
            }
            sim.current = freshSim(data);
            bump();
            setScreen("revelation");
          }}
        >
          Accepter
        </button>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => {
            setError(path === "power" ? POWER_REFUSED : REFUSED);
            setScreen(path === "power" ? "power" : "connexion");
          }}
        >
          Annuler
        </button>
      </main>
    );
  } else if (view) {
    body = <RevelationContext.Provider value={source}>{revelationScreen(view, data)}</RevelationContext.Provider>;
  }

  return (
    <>
      <div className="demo-bar" role="note">
        <span>
          <b>Démo</b> · rien n&apos;est réel (ni Spotify, ni IA). Code : n&apos;importe quel DISQ-XXXXXX. Power : 32 caractères 0-9 a-f, ex.{" "}
          <code>0123456789abcdef0123456789abcdef</code>.
        </span>
        <span className="row" style={{ gap: 12 }}>
          <label className="row" style={{ gap: 6 }}>
            <input type="checkbox" checked={withPlaylists} onChange={(e) => setWithPlaylists(e.target.checked)} /> Le compte a des playlists
          </label>
          <button type="button" className="link-btn" onClick={restart}>
            Recommencer
          </button>
        </span>
      </div>
      {body}
    </>
  );
}

const RevelationContext = RevelationSourceContext;

async function demoCheck(_prev: InvitationState, formData: FormData): Promise<InvitationState> {
  await wait(500);
  const raw = formData.get("code");
  const code = typeof raw === "string" ? raw.trim().toUpperCase().replace(/[\s_]+/g, "") : "";
  if (!/^DISQ-([A-Z0-9]{4}|[A-Z0-9]{6})$/.test(code)) return { status: "error", message: "Un code ressemble à DISQ-7K2P4M.", code };
  return { status: "ok" };
}

function revelationScreen(sim: Sim, data: DemoData): React.ReactNode {
  const N = data.tracks.length;
  if (sim.stage === "import" || sim.stage === "analyse") {
    return (
      <main className="page page--bare" key={sim.stage}>
        <WaitScreen stage={sim.stage} />
      </main>
    );
  }
  if (sim.stage === "playlists") {
    return (
      <main className="page page--bare">
        <PlaylistsScreen candidates={candidates(data)} />
      </main>
    );
  }
  if (sim.stage === "creation" || sim.stage === "done") {
    return (
      <main className="page page--bare">
        <CreationScreen />
      </main>
    );
  }
  // Proposition : compteurs recalculés comme lib/revelation.ts (proposalImpact).
  const kept = sim.bacs.filter((b) => b.kept);
  const homes = new Map<number, number>();
  for (const b of kept) for (const i of b.tracks) homes.set(i, (homes.get(i) ?? 0) + 1);
  const bacs: ProposalBac[] = sim.bacs.map((b) => ({
    id: b.id,
    name: b.name,
    sleeve: b.sleeve,
    mark: b.mark,
    pitch: b.pitch,
    axis: b.axis,
    color: b.color,
    kept: b.kept,
    count: b.tracks.length,
    alone: b.tracks.filter((i) => (homes.get(i) ?? 0) === (b.kept ? 1 : 0)).length,
    filling: false,
    fromPlaylist: b.fromPlaylist,
    examples: b.tracks.slice(0, 3).map((i) => {
      const t = data.tracks[i];
      return { track_id: t.track_id, title: t.title, artist: t.artist, cover_url: t.cover_url, isrc: t.isrc };
    }),
  }));
  return (
    <main className="page page--bare">
      <ProposalScreen likes={N} period="tout l'historique" size={librarySize(N)} bacs={bacs} divers={N - homes.size} total={N} filling={false} error={null} />
    </main>
  );
}
