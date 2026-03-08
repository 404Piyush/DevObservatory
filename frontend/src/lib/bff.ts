import { cookies } from "next/headers";

import { backendBaseUrl } from "@/lib/backend";

export async function backendFetchWithAuth(path: string, init?: RequestInit) {
  const cookieStore = await cookies();
  const access = cookieStore.get("access_token")?.value;
  const refresh = cookieStore.get("refresh_token")?.value;

  const run = async (token: string | undefined) => {
    const headers = new Headers(init?.headers);
    if (token) headers.set("authorization", `Bearer ${token}`);
    return fetch(`${backendBaseUrl()}${path}`, { ...init, headers });
  };

  let res = await run(access);
  if (res.status !== 401 || !refresh) return res;

  const refreshRes = await fetch(`${backendBaseUrl()}/auth/refresh`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ refresh_token: refresh }),
  });

  const refreshData = (await refreshRes.json().catch(() => null)) as
    | { access_token: string; refresh_token: string }
    | null;

  if (!refreshRes.ok || !refreshData) return res;

  const secure = process.env.NODE_ENV === "production";
  cookieStore.set("access_token", refreshData.access_token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 15,
  });
  cookieStore.set("refresh_token", refreshData.refresh_token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  res = await run(refreshData.access_token);
  return res;
}
