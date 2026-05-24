import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import HomeClient from "./HomeClient";

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) redirect("/login");
  return <HomeClient />;
}
