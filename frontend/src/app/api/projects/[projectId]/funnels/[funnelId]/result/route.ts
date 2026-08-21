import { NextResponse } from "next/server";

import { backendFetchWithAuth } from "@/lib/bff";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ projectId: string; funnelId: string }> },
) {
  const { projectId, funnelId } = await params;
  const url = new URL(req.url);
  const hours = url.searchParams.get("window_hours") ?? "24";
  const res = await backendFetchWithAuth(
    `/projects/${projectId}/funnels/${funnelId}/result?window_hours=${encodeURIComponent(hours)}`,
    { method: "GET" },
  );
  const data = await res.json().catch(() => null);
  return NextResponse.json(data ?? { detail: "Upstream error" }, { status: res.status });
}