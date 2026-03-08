import { NextResponse } from "next/server";

import { backendFetchWithAuth } from "@/lib/bff";

export async function GET() {
  const res = await backendFetchWithAuth("/orgs", { method: "GET" });
  const data = await res.json().catch(() => null);
  return NextResponse.json(data ?? { detail: "Upstream error" }, { status: res.status });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const res = await backendFetchWithAuth("/orgs", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  return NextResponse.json(data ?? { detail: "Upstream error" }, { status: res.status });
}
