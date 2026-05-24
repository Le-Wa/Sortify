import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getUserSettings } from "@/lib/supabase/queries";
import SettingsClient from "./SettingsClient";

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) redirect("/login");

  const user = await getUserSettings(session.userId);
  if (!user) redirect("/login");

  return (
    <main className="s-page">
      <div style={{ marginBottom: 32 }}>
        <div className="s-section-title" style={{ marginBottom: 0 }}>Paramètres</div>
      </div>
      <SettingsClient cronEnabled={user.cron_enabled} importSince={user.import_since} />
    </main>
  );
}
