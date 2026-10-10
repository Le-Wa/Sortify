import Link from "next/link";
import { requireMember } from "@/lib/auth";
import { hourOf, nextCron } from "@/lib/dates";
import { homeFor } from "@/lib/library";
import { countMembers, MAX_MEMBERS, openInvitations } from "@/lib/members";
import { SignOutButton } from "../ui/SignOutButton";
import { InviteCard } from "./InviteCard";
import { SortSettings } from "./SortSettings";

export default async function ReglagesPage() {
  const member = await requireMember();
  const home = await homeFor(member.spotify_id);
  const [codes, members] = member.is_owner
    ? await Promise.all([openInvitations(member.spotify_id), countMembers()])
    : [[], 0];

  return (
    <main className="page page--bare">
      <Link href={home} className="back">
        ‹ {home === "/accueil" ? "Accueil" : "Retour"}
      </Link>
      <h1 className="display">Réglages</h1>

      <div className="label section-label">Le tri</div>
      <SortSettings cronHour={hourOf(nextCron())} sortPaused={member.sort_paused} suggestBacs={member.suggest_bacs} />

      {member.is_owner ? (
        <>
          <div className="label section-label">Les potes</div>
          <InviteCard code={codes[0]?.code ?? null} members={members} max={MAX_MEMBERS} />
        </>
      ) : null}

      <div className="grow" />
      <SignOutButton />
    </main>
  );
}
