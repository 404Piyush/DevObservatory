import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { backendBaseUrl } from "@/lib/backend";

export async function POST(req: Request) {
  const body = (await req.json()) as { email?: string; password?: string };

  const res = await fetch(`${backendBaseUrl()}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = (await res.json().catch(() => null)) as
    | { access_token: string; refresh_token: string }
    | { detail?: string }
    | null;

  if (!res.ok || !data || !("access_token" in data) || !("refresh_token" in data)) {
    return NextResponse.json(
      { detail: (data as { detail?: string } | null)?.detail ?? "Login failed" },
      { status: res.status || 401 },
    );
  }

  const cookieStore = await cookies();
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
