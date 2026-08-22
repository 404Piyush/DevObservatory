import { NextResponse } from "next/server";

import { backendBaseUrl } from "@/lib/backend";
import { cookies } from "next/headers";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const url = new URL(req.url);
  const qs = url.searchParams.toString();

  const cookieStore = await cookies();
  const access = cookieStore.get("access_token")?.value;

  const upstream = await fetch(
    `${backendBaseUrl()}/projects/${projectId}/events/export${qs ? `?${qs}` : ""}`,
    {
      headers: { authorization: access ? `Bearer ${access}` : "" },
      cache: "no-store",
    },
  );

  if (!upstream.ok || !upstream.body) {
    return new NextResponse("Upstream error", { status: upstream.status || 502 });
  }

  // Forward the stream and Content-Disposition so the browser triggers
  // a download instead of rendering in-page.
  const headers = new Headers();
  const cd = upstream.headers.get("content-disposition");
  if (cd) headers.set("content-disposition", cd);
  headers.set("content-type", upstream.headers.get("content-type") ?? "text/csv");
  headers.set("cache-control", "no-store");

  return new Response(upstream.body, { status: upstream.status, headers });
}