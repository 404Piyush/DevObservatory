"use client";

import { useEffect, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Metrics = {
  total_events: number;
  events_per_minute: number;
  active_projects: number;
};

type Org = { id: string; name: string; created_at: string };

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [orgs, setOrgs] = useState<Org[] | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/metrics/overview").then((r) => r.json() as Promise<Metrics>),
      fetch("/api/orgs").then((r) => r.json() as Promise<Org[]>),
    ])
      .then(([m, o]) => {
        setMetrics(m);
        setOrgs(o);
      })
      .catch(() => {
        setMetrics({ total_events: 0, events_per_minute: 0, active_projects: 0 });
        setOrgs([]);
      });
  }, []);

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Total events</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">
            {metrics ? metrics.total_events.toLocaleString() : "—"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Events / minute</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">
            {metrics ? metrics.events_per_minute.toLocaleString() : "—"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Active projects</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">
            {metrics ? metrics.active_projects.toLocaleString() : "—"}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Organizations</CardTitle>
        </CardHeader>
        <CardContent>
          {orgs === null ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : orgs.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              Create an organization in Projects.
            </div>
          ) : (
            <ul className="grid gap-2">
              {orgs.map((o) => (
                <li key={o.id} className="flex items-center justify-between rounded-md border p-3">
                  <div className="font-medium">{o.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(o.created_at).toLocaleString()}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
