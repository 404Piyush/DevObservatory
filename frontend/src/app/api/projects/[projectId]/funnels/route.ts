import { NextResponse } from "next/server";

import { backendFetchWithAuth } from "@/lib/bff";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const res = await backendFetchWithAuth(`/projects/${projectId}/funnels`, { method: "GET" });
  const data = await res.json().catch(() => null);
  return NextResponse.json(data ?? [], { status: res.status });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const body = (await req.json()) as { name: string; steps: string[] };
  const res = await backendFetchWithAuth(`/projects/${projectId}/funnels`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  return NextResponse.json(data ?? { detail: "Upstream error" }, { status: res.status });
}