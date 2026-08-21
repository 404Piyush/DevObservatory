import { NextResponse } from "next/server";

import { backendFetchWithAuth } from "@/lib/bff";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ projectId: string; funnelId: string }> },
) {
  const { projectId, funnelId } = await params;
  const res = await backendFetchWithAuth(`/projects/${projectId}/funnels/${funnelId}`, {
    method: "DELETE",
  });
  return new NextResponse(null, { status: res.status });
}