import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export default async function Home() {
  const cookieStore = await cookies();
  const access = cookieStore.get("access_token")?.value;
  if (access) redirect("/dashboard");
  redirect("/login");
}
