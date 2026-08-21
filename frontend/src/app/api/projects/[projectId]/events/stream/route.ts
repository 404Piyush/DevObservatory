import { cookies } from "next/headers";
import { NextRequest } from "next/server";

import { backendBaseUrl } from "@/lib/backend";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const cookieStore = await cookies();
  const access = cookieStore.get("access_token")?.value;

  const upstream = await fetch(`${backendBaseUrl()}/projects/${projectId}/events/stream`, {
    headers: { authorization: access ? `Bearer ${access}` : "" },
    cache: "no-store",
    signal: req.signal,
  });

  // Forward the SSE stream as-is.
  const stream = upstream.body;
  if (!stream) {
    return new Response("No upstream stream", { status: 502 });
  }

  return new Response(stream, {
    status: upstream.status,
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "text/event-stream",
      "cache-control": "no-cache",
      "x-accel-buffering": "no",
      connection: "keep-alive",
    },
  });
}