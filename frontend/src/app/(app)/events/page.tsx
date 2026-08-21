"use client";

import { useEffect } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ApiError } from "@/lib/api-client";
import { useEvents, useOrgs, useProjects } from "@/lib/queries";
import { useSelectorStore } from "@/components/app/selector-store";

export default function EventsPage() {
  const orgId = useSelectorStore((s) => s.orgId);
  const projectId = useSelectorStore((s) => s.projectId);
  const setOrg = useSelectorStore((s) => s.setOrg);
  const setProject = useSelectorStore((s) => s.setProject);

  const orgs = useOrgs();
  const projects = useProjects(orgId);
  const events = useEvents(projectId);

  // Auto-select first org if none picked yet
  useEffect(() => {
    if (!orgId && orgs.data && orgs.data.length > 0) {
      setOrg(orgs.data[0].id);
    }
  }, [orgId, orgs.data, setOrg]);

  // Auto-select first project under the chosen org
  useEffect(() => {
    if (projects.data && projects.data.length > 0) {
      const exists = projects.data.some((p) => p.id === projectId);
      if (!exists) setProject(projects.data[0].id);
    } else if (projects.data && projects.data.length === 0) {
      setProject(null);
    }
  }, [projects.data, projectId, setProject]);

  useEffect(() => {
    if (events.error) {
      const detail = events.error instanceof ApiError ? events.error.detail : "Could not load events";
      toast.error(detail);
    }
  }, [events.error]);

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="org-select">Organization</Label>
            <Select value={orgId ?? ""} onValueChange={(v) => setOrg(v)}>
              <SelectTrigger id="org-select">
                <SelectValue placeholder="Select organization" />
              </SelectTrigger>
              <SelectContent>
                {(orgs.data ?? []).map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="project-select">Project</Label>
            <Select
              value={projectId ?? ""}
              onValueChange={(v) => setProject(v)}
              disabled={!orgId || (projects.data?.length ?? 0) === 0}
            >
              <SelectTrigger id="project-select">
                <SelectValue placeholder={orgId ? "Select project" : "Pick an organization first"} />
              </SelectTrigger>
              <SelectContent>
                {(projects.data ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Recent events</CardTitle>
          <Button variant="outline" size="sm" onClick={() => events.refetch()} disabled={!projectId || events.isFetching}>
            {events.isFetching ? "Refreshing…" : "Refresh"}
          </Button>
        </CardHeader>
        <CardContent>
          {!projectId ? (
            <div className="text-sm text-muted-foreground">Pick a project to see its events.</div>
          ) : events.isLoading ? (
            <div className="text-sm text-muted-foreground">Loading events…</div>
          ) : !events.data || events.data.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No events yet. Send one with <code className="font-mono text-xs">POST /api/events</code>.
            </div>
          ) : (
            <ul className="grid gap-2">
              {events.data.map((e) => (
                <li key={e.id} className="rounded-md border p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{e.event_name}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(e.received_at).toLocaleString()}
                    </span>
                  </div>
                  {e.user_id ? (
                    <div className="text-xs text-muted-foreground">user_id: {e.user_id}</div>
                  ) : null}
                  {e.properties && Object.keys(e.properties).length > 0 ? (
                    <pre className="mt-1 overflow-x-auto rounded bg-muted p-2 text-xs">
                      {JSON.stringify(e.properties, null, 2)}
                    </pre>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}