import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export default async function RootPage() {
  const session = await getServerSession(authOptions);
  redirect(session ? "/dashboard" : "/login");
}
