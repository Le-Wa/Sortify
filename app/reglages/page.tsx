import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { hourOf, nextCron, relativeDay } from "@/lib/dates";
import { homeFor } from "@/lib/library";
import { countSharedAppMembers, MAX_MEMBERS, openInvitations } from "@/lib/members";
import { SignOutButton } from "../ui/SignOutButton";
import { isStalled, kickJob, latestJob, recentIncidents, type Job } from "@/lib/jobs";
import { oldLikesStatus, ownerName } from "@/lib/old-likes";
import { OldLikesCard, type OldLikesView } from "./OldLikesCard";
import { PotesSettings } from "./PotesSettings";
import { listBacs } from "@/lib/bacs";
import { setAsideTracks } from "@/lib/daily";
import { hasActiveBacs } from "@/lib/library";
import { DeleteData, ReanalyseCard } from "./DataSettings";
import { InviteCard } from "./InviteCard";
import { SortSettings } from "./SortSettings";
import { ThemeSettings } from "./ThemeSettings";
import { OwnKeyCard } from "./OwnKeyCard";
import { NotifyCard } from "./NotifyCard";
import { env } from "@/lib/env";
import { anthropicKeyHint } from "@/lib/own-keys";
import { COST_ALERT_USD, costByMember, usd } from "@/lib/ai-budget";
import { cookies } from "next/headers";
import { THEME_COOKIE, themeOf } from "@/lib/theme";

const KIND_LABEL: Record<string, string> = {
  tri: "tri",
  import: "import",
  analyse: "analyse",
  creation: "création des playlists",
  reanalyse: "ré-analyse",
  bac: "nouveau bac",
  anciens: "anciens likes",
};

const MONTH = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "Europe/Paris" });

/** Carte « Tes anciens likes » : null si tout est déjà dans Sortify, ou si Spotify ne répond pas (la page reste utilisable). */
async function oldLikesView(memberId: string, isOwner: boolean): Promise<OldLikesView | null> {
  try {
    const [s, owner] = await Promise.all([oldLikesStatus(memberId, isOwner), ownerName()]);
    const job = s.job;
    if (job?.status === "running" && isStalled(job as Job<unknown>)) await kickJob(job.id);
    if (s.older === 0 && job?.status !== "running") return null;
    return {
      older: s.older,
      since: s.before ? MONTH.format(new Date(s.before)) : "",
      cost: usd(s.cost),
      minutes: s.minutes,
      direct: s.direct,
      owner,
      request: s.request?.status === "pending" || s.request?.status === "refused" ? s.request.status : null,
      job: job
        ? { running: job.status === "running", phase: job.progress.phase, fetched: job.progress.fetched, placed: job.progress.placed, divers: job.progress.divers, failed: job.status === "failed" ? job.error : null }
        : null,
    };
  } catch (error) {
    console.error("Anciens likes indisponibles :", error instanceof Error ? error.message : error);
    return null;
  }
}

export default async function ReglagesPage() {
  const member = await requireMember();
  const home = await homeFor(member.spotify_id);
  const [hasBacs, reanalyse, setAside, oldLikes] = await Promise.all([
    hasActiveBacs(member.spotify_id),
    latestJob(member.spotify_id, "reanalyse"),
    setAsideTracks(member.spotify_id).then((t) => t.length),
    oldLikesView(member.spotify_id, member.is_owner),
  ]);
  const [codes, members, incidents, costs] = member.is_owner
    ? await Promise.all([openInvitations(member.spotify_id), countSharedAppMembers(), recentIncidents(7), costByMember(30)])
    : [[], 0, [], []];

  return (
    <main className="page page--bare">
      <Link href={home} className="back">
        ‹ {home === "/accueil" ? "Accueil" : "Retour"}
      </Link>
      <h1 className="display">Réglages</h1>

      <div className="label section-label">Le tri</div>
      <SortSettings
        cronHour={hourOf(nextCron())}
        sortPaused={member.sort_paused}
        suggestBacs={member.suggest_bacs}
        unlikeAction={member.unlike_action}
        arrivalPlaylist={member.arrival_playlist}
      />

      <NotifyCard publicKey={env.vapidPublicKey} />

      <Link href="/reglages/mis-de-cote" className="list__row" style={{ textDecoration: "none", color: "inherit", background: "var(--card)", borderRadius: 14 }}>
        <span>Titres mis de côté</span>
        <span className="mono muted">{setAside} ›</span>
      </Link>

      <div className="label section-label">Power user</div>
      <OwnKeyCard hint={await anthropicKeyHint(member.spotify_id)} required={Boolean(member.spotify_client_id)} />

      <div className="label section-label">Apparence</div>
      <ThemeSettings theme={themeOf((await cookies()).get(THEME_COOKIE)?.value)} />

      {hasBacs ? (
        <>
          <div className="label section-label">Tes bacs</div>
          <ReanalyseCard running={reanalyse?.status === "running"} />
          {oldLikes ? <OldLikesCard view={oldLikes} /> : null}

          <div className="label section-label">Les potes</div>
          <PotesSettings
            on={member.share_bacs}
            bacs={(await listBacs(member.spotify_id, ["active"])).map((b) => ({ id: b.id, name: b.name, shared: b.shared }))}
          />
        </>
      ) : null}

      {member.is_owner ? (
        <>
          <div className="label section-label">Les potes</div>
          <InviteCard
            code={codes[0]?.code ?? null}
            members={members}
            max={MAX_MEMBERS}
            dashboardUrl={`https://developer.spotify.com/dashboard/${env.spotifyClientId}/settings`}
          />

          <div className="label section-label">Coût de l&apos;IA (30 jours)</div>
          {costs.length === 0 ? (
            <p className="small muted" style={{ margin: "0 4px" }}>
              Aucun appel à l&apos;IA ce mois-ci.
            </p>
          ) : (
            <div className="list">
              {costs.map((c) => (
                <div key={c.memberId} className="list__row" style={{ alignItems: "flex-start", flexDirection: "column", gap: 2 }}>
                  <span className="row between" style={{ width: "100%" }}>
                    <b>{c.name}</b>
                    <span className="mono" style={c.cost > COST_ALERT_USD ? { color: "var(--accent)" } : undefined}>
                      {usd(c.cost)}
                    </span>
                  </span>
                  {c.ownKey > 0 ? <span className="small muted">+ {usd(c.ownKey)} sur sa propre clé</span> : null}
                </div>
              ))}
            </div>
          )}
          <p className="small muted" style={{ margin: "0 4px" }}>
            Une première analyse coûte 2 à 9 $ selon la taille de la bibliothèque, un mois de tri environ 0,50 $. Alerte sur l&apos;Accueil au-delà de {usd(COST_ALERT_USD)} en 7 jours.
          </p>

          <div className="label section-label">Incidents (7 jours)</div>
          {incidents.length === 0 ? (
            <p className="small muted" style={{ margin: "0 4px" }}>
              Aucun tri, import ou analyse en échec cette semaine.
            </p>
          ) : (
            <div className="list">
              {incidents.map((i, k) => (
                <div key={k} className="list__row" style={{ alignItems: "flex-start", flexDirection: "column", gap: 2 }}>
                  <span>
                    <b>{i.member}</b> · {KIND_LABEL[i.kind]} · {relativeDay(new Date(i.at))} {hourOf(new Date(i.at))}
                  </span>
                  <span className="small muted">{i.error}</span>
                </div>
              ))}
            </div>
          )}
        </>
      ) : null}

      <div className="grow" />
      <div className="stack" style={{ gap: 4 }}>
        <SignOutButton />
        <DeleteData isOwner={member.is_owner} />
        <p className="small muted" style={{ margin: 0, textAlign: "center" }}>
          Tes playlists restent dans Spotify.
        </p>
      </div>
    </main>
  );
}
