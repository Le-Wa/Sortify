import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getUserWithOnboarding } from "@/lib/supabase/queries";
import OnboardingV2Client from "./OnboardingV2Client";

export default async function OnboardingPage() {
  const session = await getServerSession(authOptions);

  // Not authenticated — show landing (S0)
  if (!session?.userId) {
    return <OnboardingV2Client initialStep={null} initialMode={null} />;
  }

  const dbUser = await getUserWithOnboarding(session.userId);

  // v1 compat: onboarding_completed = true but no v2 status yet
  if (!dbUser) redirect("/dashboard");

  // Already done
  if (dbUser.onboarding_status === "complete") redirect("/dashboard");

  // In progress or pending — resume
  return (
    <OnboardingV2Client
      initialStep={dbUser.onboarding_step}
      initialMode={dbUser.onboarding_mode}
    />
  );
}
