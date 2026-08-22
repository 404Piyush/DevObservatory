import { NextRequest, NextResponse } from "next/server";

import { backendFetchWithAuth } from "@/lib/bff";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const incoming = req.nextUrl.searchParams;
  const eventName = incoming.get("event_name") ?? "user_signup";
  const days = incoming.get("days") ?? "14";
  const maxWindow = incoming.get("max_window") ?? "14";
  const url = `/retention/projects/${projectId}/retention?event_name=${encodeURIComponent(
    eventName,
  )}&days=${days}&max_window=${maxWindow}`;
  const res = await backendFetchWithAuth(url, { method: "GET" });
  const data = await res.json().catch(() => null);
  return NextResponse.json(data ?? { detail: "Upstream error" }, { status: res.status });
}