/**
 * Typed JSON API client for the BFF.
 *
 * Pages should use TanStack Query with these fetchers rather than hand-rolling
 * `fetch("/api/...")` calls; the BFF forwards to the backend and handles
 * cookie-based auth + refresh.
 */

export class ApiError extends Error {
  status: number;
  detail: string;
  constructor(status: number, detail: string) {
    super(detail);
    this.status = status;
    this.detail = detail;
  }
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    let detail = `${res.status}`;
    try {
      const body = (await res.json()) as { detail?: string } | null;
      if (body?.detail) detail = body.detail;
    } catch {
      // ignore
    }
    if (res.status === 401) {
      // BFF may have just refreshed; if we still got 401, the session is gone.
      // Hard-redirect to /login so the user gets a clean state.
      if (typeof window !== "undefined" && !path.startsWith("/api/auth/")) {
        window.location.assign("/login");
      }
    }
    throw new ApiError(res.status, detail);
  }
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string) => call<T>(path),
  post: <T>(path: string, body: unknown) =>
    call<T>(path, { method: "POST", body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    call<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    call<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(path: string) => call<T>(path, { method: "DELETE" }),
};