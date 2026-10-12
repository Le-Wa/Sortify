import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { hourOf, nextCron, relativeDay } from "@/lib/dates";
import { homeFor } from "@/lib/library";
import { countMembers, MAX_MEMBERS, openInvitations } from "@/lib/members";
import { SignOutButton } from "../ui/SignOutButton";
import { latestJob, recentIncidents } from "@/lib/jobs";
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
import { cookies } from "next/headers";
import { THEME_COOKIE, themeOf } from "@/lib/theme";

const KIND_LABEL: Record<string, string> = {
  tri: "tri",
  import: "import",
  analyse: "analyse",
  creation: "création des playlists",
  reanalyse: "ré-analyse",
  bac: "nouveau bac",
};

export default async function ReglagesPage() {
  const member = await requireMember();
  const home = await homeFor(member.spotify_id);
  const [hasBacs, reanalyse, setAside] = await Promise.all([
    hasActiveBacs(member.spotify_id),
    latestJob(member.spotify_id, "reanalyse"),
    setAsideTracks(member.spotify_id).then((t) => t.length),
  ]);
  const [codes, members, incidents] = member.is_owner
    ? await Promise.all([openInvitations(member.spotify_id), countMembers(), recentIncidents(7)])
    : [[], 0, []];

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
      <OwnKeyCard hint={await anthropicKeyHint(member.spotify_id)} />

      <div className="label section-label">Apparence</div>
      <ThemeSettings theme={themeOf((await cookies()).get(THEME_COOKIE)?.value)} />

      {hasBacs ? (
        <>
          <div className="label section-label">Tes bacs</div>
          <ReanalyseCard running={reanalyse?.status === "running"} />
        </>
      ) : null}

      {member.is_owner ? (
        <>
          <div className="label section-label">Les potes</div>
          <InviteCard code={codes[0]?.code ?? null} members={members} max={MAX_MEMBERS} />

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
