import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import BenchmarkClient from "./BenchmarkClient";

export default async function BenchmarkPage() {
  const session = await getServerSession(authOptions);
  if (!session?.userId) redirect("/");
  return <BenchmarkClient />;
}
