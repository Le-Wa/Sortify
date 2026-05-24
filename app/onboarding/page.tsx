import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getUserOnboarding } from "@/lib/supabase/queries";
import OnboardingClient from "./OnboardingClient";

export default async function OnboardingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) redirect("/login");

  const dbUser = await getUserOnboarding(session.userId);
  if (dbUser?.onboarding_completed) redirect("/dashboard");

  const userName = session.user?.name ?? "toi";

  return <OnboardingClient userName={userName} />;
}
