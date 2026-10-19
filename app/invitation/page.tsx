import Link from "next/link";
import { redirect } from "next/navigation";
import { currentMember } from "@/lib/auth";
import { homeFor } from "@/lib/library";
import { InvitationForm, InvitationIntro } from "./InvitationForm";

export default async function InvitationPage() {
  const member = await currentMember();
  if (member) redirect(await homeFor(member.spotify_id));

  return (
    <main className="page page--bare">
      <Link href="/" className="back">
        ‹ Connexion
      </Link>
      <InvitationIntro />
      <InvitationForm />
    </main>
  );
}
