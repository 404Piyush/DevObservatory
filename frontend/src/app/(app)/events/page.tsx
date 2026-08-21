"use client";

import { useEffect, useState } from "react";
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
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ApiError } from "@/lib/api-client";
import {
  useAnalytics,
  useEventSearch,
  useOrgs,
  useProjects,
  type EventFilters,
  type EventRecord,
} from "@/lib/queries";
import { useEventStream } from "@/lib/use-event-stream";
import { useSelectorStore } from "@/components/app/selector-store";

const TIME_PRESETS: { value: string; label: string; hours: number }[] = [
  { value: "all", label: "All time", hours: 0 },
  { value: "1h", label: "Last hour", hours: 1 },
  { value: "24h", label: "Last 24h", hours: 24 },
  { value: "7d", label: "Last 7 days", hours: 24 * 7 },
  { value: "30d", label: "Last 30 days", hours: 24 * 30 },
];

function formatBucket(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function isoMinusHours(hours: number): string {
  return new Date(Date.now() - hours * 3600 * 1000).toISOString();
}

export default function EventsPage() {
  const orgId = useSelectorStore((s) => s.orgId);
  const projectId = useSelectorStore((s) => s.projectId);
  const setOrg = useSelectorStore((s) => s.setOrg);
  const setProject = useSelectorStore((s) => s.setProject);

  const orgs = useOrgs();
  const projects = useProjects(orgId);
  const analytics = useAnalytics(projectId);
  const { liveEvents, connected } = useEventStream(projectId);

  // Search filter state
  const [eventName, setEventName] = useState("");
  const [userId, setUserId] = useState("");
  const [timePreset, setTimePreset] = useState("all");
  const [appliedFilters, setAppliedFilters] = useState<EventFilters>({ limit: 50 });
  const [cursor, setCursor] = useState<string | null>(null);
  const [extraPages, setExtraPages] = useState<EventRecord[]>([]);

  const search = useEventSearch(projectId, { ...appliedFilters, cursor: cursor ?? undefined });

  useEffect(() => {
    if (!orgId && orgs.data && orgs.data.length > 0) setOrg(orgs.data[0].id);
  }, [orgId, orgs.data, setOrg]);
  useEffect(() => {
    if (projects.data && projects.data.length > 0) {
      const exists = projects.data.some((p) => p.id === projectId);
      if (!exists) setProject(projects.data[0].id);
    } else if (projects.data && projects.data.length === 0) {
      setProject(null);
    }
  }, [projects.data, projectId, setProject]);

  useEffect(() => {
    if (search.error) {
      const detail = search.error instanceof ApiError ? search.error.detail : "Could not load events";
      toast.error(detail);
    }
  }, [search.error]);

  // Reset pagination when filters change
  useEffect(() => {
    setCursor(null);
    setExtraPages([]);
  }, [appliedFilters, projectId]);

  function applyFilters() {
    const preset = TIME_PRESETS.find((p) => p.value === timePreset);
    const next: EventFilters = {
      event_name: eventName.trim() || undefined,
      user_id: userId.trim() || undefined,
      limit: 50,
    };
    if (preset && preset.hours > 0) next.from = isoMinusHours(preset.hours);
    setAppliedFilters(next);
  }

  function clearFilters() {
    setEventName("");
    setUserId("");
    setTimePreset("all");
    setAppliedFilters({ limit: 50 });
  }

  function loadMore() {
    const next = search.data?.next_cursor ?? null;
    if (!next) return;
    setCursor(next);
  }

  // Merge: applied search (first page) + extraPages (subsequent pages) + live stream
  const searchResults = search.data?.events ?? [];
  const allSearched = [...searchResults, ...extraPages];
  const allEvents = projectId
    ? [
        ...liveEvents.filter(
          (l) =>
            (!appliedFilters.event_name || l.event_name === appliedFilters.event_name) &&
            (!appliedFilters.user_id || l.user_id === appliedFilters.user_id) &&
            (!appliedFilters.from || l.received_at >= appliedFilters.from) &&
            (!appliedFilters.to || l.received_at <= appliedFilters.to),
        ),
        ...allSearched.filter((e) => !liveEvents.some((l) => l.id === e.id)),
      ]
    : [];

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
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
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="event-name">Event name</Label>
              <Input
                id="event-name"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                placeholder="e.g. user_signup"
                disabled={!projectId}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="user-id">User ID</Label>
              <Input
                id="user-id"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                placeholder="e.g. user_123"
                disabled={!projectId}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="time-preset">Time range</Label>
              <Select value={timePreset} onValueChange={setTimePreset} disabled={!projectId}>
                <SelectTrigger id="time-preset">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIME_PRESETS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={applyFilters} disabled={!projectId}>
              Search
            </Button>
            <Button variant="outline" onClick={clearFilters} disabled={!projectId}>
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>

      {projectId ? (
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Events / minute (last 24h)</CardTitle>
            </CardHeader>
            <CardContent className="h-64">
              {analytics.isLoading ? (
                <div className="text-sm text-muted-foreground">Loading…</div>
              ) : !analytics.data || analytics.data.timeseries.length === 0 ? (
                <div className="text-sm text-muted-foreground">No events in the last 24 hours.</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analytics.data.timeseries}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="bucket" tickFormatter={formatBucket} minTickGap={32} />
                    <YAxis allowDecimals={false} />
                    <RechartsTooltip labelFormatter={(v) => new Date(v as string).toLocaleString()} />
                    <Line type="monotone" dataKey="count" stroke="#6366f1" dot={false} strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top events (last 24h)</CardTitle>
            </CardHeader>
            <CardContent className="h-64">
              {analytics.isLoading ? (
                <div className="text-sm text-muted-foreground">Loading…</div>
              ) : !analytics.data || analytics.data.top_events.length === 0 ? (
                <div className="text-sm text-muted-foreground">No events in the last 24 hours.</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.data.top_events} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis type="category" dataKey="event_name" width={120} />
                    <RechartsTooltip />
                    <Bar dataKey="count" fill="#6366f1" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>
            Events {connected ? <span className="ml-2 text-xs text-green-500">● live</span> : null}
            {allEvents.length > 0 ? (
              <span className="ml-2 text-xs text-muted-foreground">({allEvents.length})</span>
            ) : null}
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => search.refetch()}
            disabled={!projectId || search.isFetching}
          >
            {search.isFetching ? "Refreshing…" : "Refresh"}
          </Button>
        </CardHeader>
        <CardContent>
          {!projectId ? (
            <div className="text-sm text-muted-foreground">Pick a project to see its events.</div>
          ) : search.isLoading ? (
            <div className="text-sm text-muted-foreground">Loading events…</div>
          ) : allEvents.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No events match your filters. Send one with{" "}
              <code className="font-mono text-xs">POST /api/events</code>.
            </div>
          ) : (
            <>
              <ul className="grid gap-2">
                {allEvents.map((e) => (
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
              {search.data?.has_more ? (
                <div className="mt-4 flex justify-center">
                  <Button
                    variant="outline"
                    onClick={loadMore}
                    disabled={!search.data?.next_cursor}
                  >
                    Load more
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}