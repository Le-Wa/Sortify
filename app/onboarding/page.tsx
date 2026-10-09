import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getUserWithOnboarding } from "@/lib/supabase/queries";
import OnboardingV2Client from "./OnboardingV2Client";

export default async function OnboardingPage() {
  const session = await getServerSession(authOptions);

  // Not authenticated — show landing (S0)
  if (!session?.userId) {
    return <OnboardingV2Client initialStep={null} initialMode={null} initialStatus={null} />;
  }

  const dbUser = await getUserWithOnboarding(session.userId);

  // v1 compat: onboarding_completed = true but no v2 status yet
  if (!dbUser) redirect("/dashboard");

  // Already in app
  if (dbUser.onboarding_status === "complete") redirect("/dashboard");
  if (dbUser.onboarding_status === "in_progress") redirect("/dashboard");

  // pending — show landing
  return (
    <OnboardingV2Client />
  );
}
