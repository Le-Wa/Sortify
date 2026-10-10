import { redirect } from "next/navigation";
import { requireMember } from "@/lib/auth";
import { hasActiveBacs } from "@/lib/library";
import { ImportScreen } from "./ImportScreen";

/** Première visite : import et enrichissement des likes, puis analyse et proposition des bacs. */
export default async function RevelationPage() {
  const member = await requireMember();
  if (await hasActiveBacs(member.spotify_id)) redirect("/accueil");

  return (
    <main className="page page--bare">
      <ImportScreen />
    </main>
  );
}
