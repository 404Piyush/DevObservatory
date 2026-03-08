"use client";

import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Org = { id: string; name: string; created_at: string };
type Project = { id: string; organization_id: string; name: string; created_at: string };
type Event = {
  id: number;
  project_id: string;
  event_name: string;
  user_id: string | null;
  timestamp: string;
  properties: Record<string, unknown>;
  received_at: string;
};

export default function EventsPage() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [orgId, setOrgId] = useState<string>("");
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<string>("");
  const [events, setEvents] = useState<Event[]>([]);

  const selectOrg = useCallback((nextOrgId: string) => {
    setOrgId(nextOrgId);
    setProjects([]);
    setProjectId("");
    setEvents([]);
  }, []);

  const selectProject = useCallback((nextProjectId: string) => {
    setProjectId(nextProjectId);
    setEvents([]);
  }, []);

  useEffect(() => {
    fetch("/api/orgs")
      .then((r) => r.json() as Promise<Org[]>)
      .then((data) => {
        setOrgs(data);
        if (!orgId && data.length > 0) selectOrg(data[0]!.id);
      })
      .catch(() => setOrgs([]));
  }, [orgId, selectOrg]);

  useEffect(() => {
    if (!orgId) return;
    fetch(`/api/orgs/${orgId}/projects`)
      .then((r) => r.json() as Promise<Project[]>)
      .then((data) => {
        setProjects(data);
        if (data.length > 0) selectProject(data[0]!.id);
      })
      .catch(() => setProjects([]));
  }, [orgId, selectProject]);

  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/projects/${projectId}/events`)
      .then((r) => r.json() as Promise<Event[]>)
      .then((data) => setEvents(Array.isArray(data) ? data : []))
      .catch(() => setEvents([]));
  }, [projectId]);

  async function refresh() {
    if (!projectId) return;
    const res = await fetch(`/api/projects/${projectId}/events`);
    const data = (await res.json().catch(() => [])) as Event[];
    setEvents(Array.isArray(data) ? data : []);
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Recent events</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="orgSelect">Organization</Label>
              <select
                id="orgSelect"
                value={orgId}
                onChange={(e) => selectOrg(e.target.value)}
                className={cn("h-10 rounded-md border border-input bg-background px-3 text-sm")}
              >
                <option value="">—</option>
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2 md:col-span-2">
              <Label htmlFor="projectSelect">Project</Label>
              <div className="flex gap-2">
                <select
                  id="projectSelect"
                  value={projectId}
                  onChange={(e) => selectProject(e.target.value)}
                  className={cn("h-10 w-full rounded-md border border-input bg-background px-3 text-sm")}
                >
                  <option value="">—</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <Button variant="outline" onClick={() => refresh()}>
                  Refresh
                </Button>
              </div>
            </div>
          </div>

          {!projectId ? (
            <div className="text-sm text-muted-foreground">Select a project.</div>
          ) : events.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No events yet. Send an event to POST /api/events with X-API-Key.
            </div>
          ) : (
            <ul className="grid gap-2">
              {events.map((e) => (
                <li key={e.id} className="rounded-md border p-3">
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{e.event_name}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(e.received_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    user_id: {e.user_id ?? "—"} • timestamp:{" "}
                    {new Date(e.timestamp).toLocaleString()}
                  </div>
                  <pre className="mt-2 max-h-48 overflow-auto rounded bg-muted p-2 text-xs">
                    {JSON.stringify(e.properties ?? {}, null, 2)}
                  </pre>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
