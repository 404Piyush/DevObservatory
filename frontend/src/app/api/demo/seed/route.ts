import { NextResponse } from "next/server";

import { backendFetchWithAuth } from "@/lib/bff";

export async function POST() {
  const res = await backendFetchWithAuth("/demo/seed", { method: "POST" });
  const data = await res.json().catch(() => null);
  return NextResponse.json(data ?? { detail: "Upstream error" }, { status: res.status });
}