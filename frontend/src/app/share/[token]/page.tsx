"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api-client";
import type { Analytics, Project } from "@/lib/queries";

export default function PublicSharePage() {
  const token = (() => {
    if (typeof window === "undefined") return "";
    const parts = window.location.pathname.split("/");
    return parts[parts.length - 1] ?? "";
  })();

  const project = useQuery({
    queryKey: ["share", token, "project"],
    queryFn: () => api.get<Project>(`/api/share/${token}/project`),
    enabled: !!token,
    retry: false,
  });

  const analytics = useQuery({
    queryKey: ["share", token, "analytics"],
    queryFn: () => api.get<Analytics>(`/api/share/${token}/analytics`),
    enabled: !!token,
    retry: false,
  });

  if (project.isLoading || analytics.isLoading) {
    return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  }

  if (project.error || !project.data) {
    return (
      <div className="p-8 text-sm text-muted-foreground">
        This share link is invalid or has expired.
      </div>
    );
  }

  const data = analytics.data;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <div className="font-semibold">DevObservatory</div>
          <div className="text-sm text-muted-foreground">Read-only share · {project.data.name}</div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-8">
        <div className="grid gap-6">
          <h1 className="text-2xl font-semibold">{project.data.name}</h1>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Events / minute (last 24h)</CardTitle>
              </CardHeader>
              <CardContent className="h-56 sm:h-64">
                {data && data.timeseries.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.timeseries}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                      <XAxis
                        dataKey="bucket"
                        tickFormatter={(v) =>
                          new Date(v).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                        }
                        minTickGap={32}
                        tick={{ fill: "var(--chart-axis)" }}
                      />
                      <YAxis allowDecimals={false} tick={{ fill: "var(--chart-axis)" }} />
                      <RechartsTooltip
                        labelFormatter={(v) => new Date(v as string).toLocaleString()}
                      />
                      <Line type="monotone" dataKey="count" stroke="var(--chart-1)" dot={false} strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-sm text-muted-foreground">No events.</div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top events (last 24h)</CardTitle>
              </CardHeader>
              <CardContent className="h-56 sm:h-64">
                {data && data.top_events.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.top_events} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                      <XAxis type="number" allowDecimals={false} tick={{ fill: "var(--chart-axis)" }} />
                      <YAxis type="category" dataKey="event_name" width={120} tick={{ fill: "var(--chart-axis)" }} />
                      <RechartsTooltip />
                      <Bar dataKey="count" fill="var(--chart-1)" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-sm text-muted-foreground">No events.</div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}