import { NextResponse } from "next/server";

import { backendFetchWithAuth } from "@/lib/bff";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const res = await backendFetchWithAuth(`/projects/${projectId}/share-tokens`, { method: "POST" });
  const data = await res.json().catch(() => null);
  return NextResponse.json(data ?? { detail: "Upstream error" }, { status: res.status });
}