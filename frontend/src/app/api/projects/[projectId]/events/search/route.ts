import { NextRequest, NextResponse } from "next/server";

import { backendFetchWithAuth } from "@/lib/bff";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const incoming = req.nextUrl.searchParams;
  // Forward all query params as-is so the backend can validate them.
  const query = incoming.toString();
  const url = `/projects/${projectId}/events/search${query ? `?${query}` : ""}`;
  const res = await backendFetchWithAuth(url, { method: "GET" });
  const data = await res.json().catch(() => null);
  return NextResponse.json(data ?? { detail: "Upstream error" }, { status: res.status });
}