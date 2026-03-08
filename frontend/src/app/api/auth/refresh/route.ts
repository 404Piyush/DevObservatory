import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { backendBaseUrl } from "@/lib/backend";

export async function POST() {
  const cookieStore = await cookies();
  const refresh = cookieStore.get("refresh_token")?.value;
  if (!refresh) return NextResponse.json({ detail: "Missing refresh token" }, { status: 401 });

  const res = await fetch(`${backendBaseUrl()}/auth/refresh`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ refresh_token: refresh }),
  });
  const data = (await res.json().catch(() => null)) as
    | { access_token: string; refresh_token: string }
    | { detail?: string }
    | null;

  if (!res.ok || !data || !("access_token" in data) || !("refresh_token" in data)) {
    return NextResponse.json(
      { detail: (data as { detail?: string } | null)?.detail ?? "Refresh failed" },
      { status: 401 },
    );
  }

  const secure = process.env.NODE_ENV === "production";
  cookieStore.set("access_token", data.access_token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 15,
  });
  cookieStore.set("refresh_token", data.refresh_token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return NextResponse.json({ ok: true });
}
