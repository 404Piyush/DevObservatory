"use client";

import { useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ApiError } from "@/lib/api-client";
import {
  useCreateFunnel,
  useDeleteFunnel,
  useFunnelResult,
  useFunnels,
  useOrgs,
  useProjects,
} from "@/lib/queries";
import { useSelectorStore } from "@/components/app/selector-store";

const WINDOWS: { value: string; label: string; hours: number }[] = [
  { value: "24", label: "Last 24 hours", hours: 24 },
  { value: "72", label: "Last 3 days", hours: 72 },
  { value: "168", label: "Last week", hours: 168 },
  { value: "720", label: "Last 30 days", hours: 720 },
];

export default function FunnelsPage() {
  const orgId = useSelectorStore((s) => s.orgId);
  const projectId = useSelectorStore((s) => s.projectId);
  const setOrg = useSelectorStore((s) => s.setOrg);
  const setProject = useSelectorStore((s) => s.setProject);

  const orgs = useOrgs();
  const projects = useProjects(orgId);
  const funnels = useFunnels(projectId);
  const createFunnel = useCreateFunnel(projectId);
  const deleteFunnel = useDeleteFunnel(projectId);

  const [name, setName] = useState("");
  const [stepsText, setStepsText] = useState("page_view, signup, verify_email");

  const [selectedFunnelId, setSelectedFunnelId] = useState<string | null>(null);
  const [windowHours, setWindowHours] = useState(24);

  // Auto-select org/project
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

  // Default selected funnel = first
  useEffect(() => {
    if (!selectedFunnelId && funnels.data && funnels.data.length > 0) {
      setSelectedFunnelId(funnels.data[0].id);
    } else if (selectedFunnelId && funnels.data && !funnels.data.some((f) => f.id === selectedFunnelId)) {
      setSelectedFunnelId(funnels.data[0]?.id ?? null);
    }
  }, [funnels.data, selectedFunnelId]);

  const result = useFunnelResult(projectId, selectedFunnelId, windowHours);

  const steps = useMemo(
    () =>
      stepsText
        .split(/[,\n]/)
        .map((s) => s.trim())
        .filter(Boolean),
    [stepsText],
  );

  function handleApiError(err: unknown, fallback: string) {
    const detail = err instanceof ApiError ? err.detail : fallback;
    toast.error(detail);
  }

  async function onCreate() {
    if (!name.trim() || steps.length < 2) {
      toast.error("Need a name and at least 2 steps");
      return;
    }
    try {
      const created = await createFunnel.mutateAsync({ name: name.trim(), steps });
      setName("");
      setSelectedFunnelId(created.id);
      toast.success("Funnel created");
    } catch (err) {
      handleApiError(err, "Could not create funnel");
    }
  }

  async function onDelete(id: string) {
    try {
      await deleteFunnel.mutateAsync(id);
      toast.success("Funnel deleted");
    } catch (err) {
      handleApiError(err, "Could not delete funnel");
    }
  }

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
        <CardHeader>
          <CardTitle>New funnel</CardTitle>
          <CardDescription>
            Ordered list of event names. The first step is the top of the funnel; each step's
            conversion rate is the share of users from the previous step that also reached it.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="funnel-name">Name</Label>
            <Input
              id="funnel-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Signup funnel"
              disabled={!projectId}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="funnel-steps">Steps (one event name per line or comma-separated)</Label>
            <textarea
              id="funnel-steps"
              value={stepsText}
              onChange={(e) => setStepsText(e.target.value)}
              disabled={!projectId}
              rows={3}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
            {steps.length > 0 ? (
              <ol className="text-xs text-muted-foreground">
                {steps.map((s, i) => (
                  <li key={`${i}-${s}`}>{i + 1}. {s}</li>
                ))}
              </ol>
            ) : null}
          </div>
          <Button
            onClick={onCreate}
            disabled={!projectId || !name.trim() || steps.length < 2 || createFunnel.isPending}
          >
            {createFunnel.isPending ? "Creating…" : "Create funnel"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Funnels for this project</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          {funnels.isLoading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : !funnels.data || funnels.data.length === 0 ? (
            <div className="text-sm text-muted-foreground">No funnels yet.</div>
          ) : (
            <ul className="grid gap-2">
              {funnels.data.map((f) => (
                <li
                  key={f.id}
                  className="flex items-center justify-between rounded-md border p-3 text-sm"
                >
                  <div>
                    <div className="font-medium">{f.name}</div>
                    <div className="text-xs text-muted-foreground">{f.steps.join(" → ")}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant={f.id === selectedFunnelId ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedFunnelId(f.id)}
                    >
                      {f.id === selectedFunnelId ? "Showing" : "Show"}
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => onDelete(f.id)}
                      disabled={deleteFunnel.isPending}
                      aria-label="Delete funnel"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Conversion</CardTitle>
          <Select value={String(windowHours)} onValueChange={(v) => setWindowHours(Number(v))}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WINDOWS.map((w) => (
                <SelectItem key={w.value} value={w.value}>
                  {w.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          {!selectedFunnelId ? (
            <div className="text-sm text-muted-foreground">Select a funnel above.</div>
          ) : result.isLoading ? (
            <div className="text-sm text-muted-foreground">Computing…</div>
          ) : !result.data || result.data.steps.length === 0 ? (
            <div className="text-sm text-muted-foreground">No steps to show.</div>
          ) : (
            <ol className="grid gap-2">
              {result.data.steps.map((s, i) => {
                const previous = i > 0 ? result.data!.steps[i - 1].reached : null;
                const widthPct =
                  previous && previous > 0 ? Math.max(8, Math.round((s.reached / previous) * 100)) : 100;
                return (
                  <li key={s.event_name} className="rounded-md border p-3">
                    <div className="flex items-center justify-between text-sm">
                      <div>
                        <span className="font-medium">
                          {i + 1}. {s.event_name}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="font-mono text-sm">{s.reached}</div>
                        {i > 0 ? (
                          <div className="text-xs text-muted-foreground">
                            {(s.conversion_rate * 100).toFixed(1)}% from previous
                          </div>
                        ) : (
                          <div className="text-xs text-muted-foreground">top of funnel</div>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-indigo-500"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}