import Link from "next/link";
import { redirect } from "next/navigation";
import { currentMember } from "@/lib/auth";
import { homeFor } from "@/lib/library";
import { InvitationForm } from "./InvitationForm";

export default async function InvitationPage() {
  const member = await currentMember();
  if (member) redirect(await homeFor(member.spotify_id));

  return (
    <main className="page page--bare">
      <Link href="/" className="back">
        ‹ Connexion
      </Link>
      <h1 className="display">Ton code d&apos;invitation</h1>
      <p className="muted" style={{ margin: 0 }}>
        Un pote t&apos;a fait entrer dans Sortify ? Tape le code qu&apos;il t&apos;a donné, puis connecte-toi avec Spotify.
      </p>
      <InvitationForm />
    </main>
  );
}
