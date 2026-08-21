import { NextResponse } from "next/server";

import { backendBaseUrl } from "@/lib/backend";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const res = await fetch(`${backendBaseUrl()}/share/${encodeURIComponent(token)}/analytics`, {
    cache: "no-store",
  });
  const data = await res.json().catch(() => null);
  return NextResponse.json(data ?? { detail: "Invalid share token" }, { status: res.status });
}