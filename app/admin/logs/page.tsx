import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import AdminClient from "./AdminClient";

export default async function AdminLogsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) redirect("/login");

  return (
    <main style={{ padding: "36px 36px 60px", maxWidth: 1100, position: "relative", zIndex: 10 }}>
      <AdminClient />
    </main>
  );
}
