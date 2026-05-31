"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams, useRouter } from "next/navigation";

export default function OnboardingConnectPage() {
  const params = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "error">("loading");

  useEffect(() => {
    const token = params.get("token");
    if (!token) {
      router.replace("/onboarding?error=missing_token");
      return;
    }

    signIn("byok-handoff", { token, redirect: false }).then((result) => {
      if (result?.ok) {
        router.replace("/onboarding");
      } else {
        setStatus("error");
      }
    });
  }, [params, router]);

  if (status === "error") {
    return (
      <div className="s-page" style={{ textAlign: "center", paddingTop: "4rem" }}>
        <p>Connexion échouée. <a href="/onboarding">Réessayer</a></p>
      </div>
    );
  }

  return (
    <div className="s-page" style={{ textAlign: "center", paddingTop: "4rem" }}>
      <p>Connexion en cours…</p>
    </div>
  );
}
