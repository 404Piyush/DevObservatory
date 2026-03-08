import { NextResponse } from "next/server";

import { backendFetchWithAuth } from "@/lib/bff";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ projectId: string; apiKeyId: string }> },
) {
  const { projectId, apiKeyId } = await params;
  const res = await backendFetchWithAuth(`/projects/${projectId}/api-keys/${apiKeyId}`, {
    method: "DELETE",
  });
  if (res.status === 204) return new NextResponse(null, { status: 204 });
  const data = await res.json().catch(() => null);
  return NextResponse.json(data ?? { detail: "Upstream error" }, { status: res.status });
}
