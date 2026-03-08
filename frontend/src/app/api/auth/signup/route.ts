import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { backendBaseUrl } from "@/lib/backend";

export async function POST(req: Request) {
  const body = (await req.json()) as { email?: string; password?: string; name?: string | null };

  const registerRes = await fetch(`${backendBaseUrl()}/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!registerRes.ok) {
    const detail = (await registerRes.json().catch(() => null)) as { detail?: string } | null;
    return NextResponse.json(
      { detail: detail?.detail ?? "Signup failed" },
      { status: registerRes.status },
    );
  }

  const loginRes = await fetch(`${backendBaseUrl()}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: body.email, password: body.password }),
  });
  const loginData = (await loginRes.json().catch(() => null)) as
    | { access_token: string; refresh_token: string }
    | { detail?: string }
    | null;

  if (!loginRes.ok || !loginData || !("access_token" in loginData) || !("refresh_token" in loginData)) {
    return NextResponse.json(
      { detail: (loginData as { detail?: string } | null)?.detail ?? "Login failed" },
      { status: loginRes.status || 401 },
    );
  }

  const cookieStore = await cookies();
  const secure = process.env.NODE_ENV === "production";

  cookieStore.set("access_token", loginData.access_token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 15,
  });
  cookieStore.set("refresh_token", loginData.refresh_token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return NextResponse.json({ ok: true });
}
