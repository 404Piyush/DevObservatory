import { NextResponse } from "next/server";

import { backendFetchWithAuth } from "@/lib/bff";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ projectId: string; webhookId: string }> },
) {
  const { projectId, webhookId } = await params;
  const res = await backendFetchWithAuth(`/projects/${projectId}/webhooks/${webhookId}`, {
    method: "DELETE",
  });
  return new NextResponse(null, { status: res.status });
}