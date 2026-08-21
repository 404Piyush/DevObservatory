"use client";

import { useEffect } from "react";
import { toast } from "sonner";

import { Building2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/app/empty-state";
import { ApiError } from "@/lib/api-client";
import { useMetrics, useOrgs, useSeedDemo } from "@/lib/queries";
import { useSelectorStore } from "@/components/app/selector-store";

function formatNumber(n: number) {
  return n.toLocaleString();
}

export default function DashboardPage() {
  const metrics = useMetrics();
  const orgs = useOrgs();
  const seedDemo = useSeedDemo();
  const setOrg = useSelectorStore((s) => s.setOrg);
  const setProject = useSelectorStore((s) => s.setProject);

  useEffect(() => {
    if (metrics.error) {
      const detail = metrics.error instanceof ApiError ? metrics.error.detail : "Could not load metrics";
      toast.error(detail);
    }
  }, [metrics.error]);

  async function onSeedDemo() {
    try {
      const out = await seedDemo.mutateAsync();
      setOrg(out.org_id);
      setProject(out.project_id);
      toast.success(
        out.api_key
          ? "Demo created — see Projects for your new API key"
          : "Demo refreshed (org + project already existed)",
      );
    } catch (err) {
      const detail = err instanceof ApiError ? err.detail : "Could not seed demo";
      toast.error(detail);
    }
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Try it out</CardTitle>
          <CardDescription>
            Seed a demo org + project + 30 days of synthetic events in one click. Great for
            exploring the dashboards without sending real events.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={onSeedDemo} disabled={seedDemo.isPending}>
            {seedDemo.isPending ? "Seeding…" : "Seed demo data"}
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Total events</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">
            {metrics.data ? formatNumber(metrics.data.total_events) : "—"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Events / minute</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">
            {metrics.data ? formatNumber(metrics.data.events_per_minute) : "—"}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Active projects</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold">
            {metrics.data ? formatNumber(metrics.data.active_projects) : "—"}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Organizations</CardTitle>
        </CardHeader>
        <CardContent>
          {orgs.isLoading ? (
            <div className="text-sm text-muted-foreground">Loading…</div>
          ) : orgs.data && orgs.data.length > 0 ? (
                      <ul className="grid gap-2">
                        {orgs.data.map((o) => (
                          <li key={o.id} className="flex items-center justify-between rounded-md border p-3">
                            <div className="font-medium">{o.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(o.created_at).toLocaleString()}
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <EmptyState
                        icon={<Building2 className="h-8 w-8" />}
                        title="No organizations yet"
                        description="Create an organization to start grouping projects and ingesting events."
                        actions={[
                          { label: "Go to Projects", href: "/projects", variant: "outline" },
                          { label: "Seed demo data", onClick: onSeedDemo },
                        ]}
                      />
                    )}
        </CardContent>
      </Card>
    </div>
  );
}