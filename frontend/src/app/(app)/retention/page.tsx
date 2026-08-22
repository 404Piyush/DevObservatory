"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";

import { useAutoSelect } from "@/components/app/use-auto-select";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ApiError } from "@/lib/api-client";
import { useProjects, useRetention } from "@/lib/queries";
import { useSelectorStore } from "@/components/app/selector-store";
import { cn } from "@/lib/utils";

const DAYS_OPTIONS = [
  { value: "7", label: "Last 7 days" },
  { value: "14", label: "Last 14 days" },
  { value: "30", label: "Last 30 days" },
];

function heatColor(rate: number): string {
  // Map 0..1 to a sequential bg-indigo ramp. rate=0 → transparent.
  const clamped = Math.max(0, Math.min(1, rate));
  const alpha = clamped * 0.85;
  return `rgba(99, 102, 241, ${alpha.toFixed(3)})`;
}

export default function RetentionPage() {
  const orgId = useSelectorStore((s) => s.orgId);
  const projectId = useSelectorStore((s) => s.projectId);
  const setProject = useSelectorStore((s) => s.setProject);

  const projects = useProjects(orgId);
  const [eventName, setEventName] = useState("user_signup");
  const [days, setDays] = useState(14);
  const [maxWindow, setMaxWindow] = useState(14);

  const retention = useRetention(projectId, eventName, days, maxWindow);

  // Auto-select first project when data arrives, but don't clobber a
  // user-picked value on every refetch.
  useAutoSelect(projects.data, !projectId && !!projects.data && projects.data.length > 0, (projects) => {
    setProject(projects[0]!.id);
  });

  useEffect(() => {
    if (retention.error) {
      const detail =
        retention.error instanceof ApiError ? retention.error.detail : "Could not load retention";
      toast.error(detail);
    }
  }, [retention.error]);

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Retention</CardTitle>
          <CardDescription>
            For each cohort day (rows), the share of users whose first
            <code className="mx-1 font-mono text-xs">{eventName}</code>
            was on that day who returned on day+k (columns).
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="grid gap-2">
            <Label htmlFor="ret-event">Starting event</Label>
            <Input
              id="ret-event"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              placeholder="user_signup"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ret-days">Cohort span</Label>
            <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
              <SelectTrigger id="ret-days">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DAYS_OPTIONS.map((d) => (
                  <SelectItem key={d.value} value={d.value}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="ret-window">Retention window</Label>
            <Input
              id="ret-window"
              type="number"
              min={1}
              max={30}
              value={maxWindow}
              onChange={(e) => setMaxWindow(Math.max(1, Math.min(30, Number(e.target.value))))}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            Heatmap{" "}
            {retention.data ? (
              <span className="ml-2 text-xs text-muted-foreground">
                ({retention.data.cohorts.length} cohorts × {retention.data.max_window} days)
              </span>
            ) : null}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!projectId ? (
            <div className="text-sm text-muted-foreground">Pick a project first.</div>
          ) : retention.isLoading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : !retention.data || retention.data.cohorts.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No events match. Send some events for the project.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr>
                    <th className="sticky left-0 bg-background p-2 text-left font-medium">
                      Cohort
                    </th>
                    <th className="p-2 text-left font-medium">Size</th>
                    {Array.from({ length: retention.data.max_window }, (_, i) => (
                      <th key={i} className="p-2 text-left font-medium">
                        +{i}d
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {retention.data.cohorts.map((cohort) => (
                    <tr key={cohort.cohort_day} className="border-t">
                      <td className="sticky left-0 bg-background p-2 font-mono">
                        {cohort.cohort_day}
                      </td>
                      <td className="p-2 font-mono">{cohort.cohort_size}</td>
                      {Array.from({ length: retention.data.max_window }, (_, i) => {
                        const rate = cohort.retention[i] ?? 0;
                        return (
                          <td
                            key={i}
                            className={cn("p-2 font-mono")}
                            style={{ backgroundColor: heatColor(rate) }}
                            title={`${cohort.cohort_day} +${i}d: ${(rate * 100).toFixed(1)}%`}
                          >
                            {cohort.cohort_size > 0 ? `${Math.round(rate * 100)}%` : ""}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Reset filters</CardTitle>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            onClick={() => {
              setEventName("user_signup");
              setDays(14);
              setMaxWindow(14);
            }}
          >
            Reset
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}