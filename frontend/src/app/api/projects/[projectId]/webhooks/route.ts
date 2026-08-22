import { NextRequest, NextResponse } from "next/server";

import { backendFetchWithAuth } from "@/lib/bff";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const res = await backendFetchWithAuth(`/projects/${projectId}/webhooks`, { method: "GET" });
  const data = await res.json().catch(() => null);
  return NextResponse.json(data ?? [], { status: res.status });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const body = await req.json();
  const res = await backendFetchWithAuth(`/projects/${projectId}/webhooks`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  return NextResponse.json(data ?? { detail: "Upstream error" }, { status: res.status });
}