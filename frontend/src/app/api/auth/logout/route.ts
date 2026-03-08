import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { backendBaseUrl } from "@/lib/backend";

export async function POST() {
  const cookieStore = await cookies();
  const access = cookieStore.get("access_token")?.value;

  if (access) {
    await fetch(`${backendBaseUrl()}/auth/logout`, {
      method: "POST",
      headers: { authorization: `Bearer ${access}` },
    }).catch(() => null);
  }

  cookieStore.delete("access_token");
  cookieStore.delete("refresh_token");

  return NextResponse.json({ ok: true });
}
