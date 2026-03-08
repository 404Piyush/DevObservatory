"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Org = { id: string; name: string; created_at: string };
type Project = { id: string; organization_id: string; name: string; created_at: string };
type ApiKey = {
  id: string;
  project_id: string;
  name: string;
  created_at: string;
  revoked_at: string | null;
  last_used_at: string | null;
};
type ApiKeyCreated = ApiKey & { api_key: string };

export default function ProjectsPage() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [orgId, setOrgId] = useState<string>("");
  const [orgName, setOrgName] = useState("");

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<string>("");
  const [projectName, setProjectName] = useState("");

  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [apiKeyName, setApiKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState<ApiKeyCreated | null>(null);

  const selectOrg = useCallback((nextOrgId: string) => {
    setOrgId(nextOrgId);
    setProjects([]);
    setProjectId("");
    setApiKeys([]);
    setCreatedKey(null);
  }, []);

  const selectProject = useCallback((nextProjectId: string) => {
    setProjectId(nextProjectId);
    setApiKeys([]);
    setCreatedKey(null);
  }, []);

  const selectedProject = useMemo(
    () => projects.find((p) => p.id === projectId) ?? null,
    [projects, projectId],
  );

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
    fetch(`/api/projects/${projectId}/api-keys`)
      .then((r) => r.json() as Promise<ApiKey[]>)
      .then((data) => setApiKeys(data))
      .catch(() => setApiKeys([]));
  }, [projectId]);

  async function createOrg() {
    const res = await fetch("/api/orgs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: orgName }),
    });
    if (!res.ok) return;
    const org = (await res.json()) as Org;
    setOrgs((prev) => [org, ...prev]);
    selectOrg(org.id);
    setOrgName("");
  }

  async function createProject() {
    if (!orgId) return;
    const res = await fetch(`/api/orgs/${orgId}/projects`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: projectName }),
    });
    if (!res.ok) return;
    const project = (await res.json()) as Project;
    setProjects((prev) => [project, ...prev]);
    selectProject(project.id);
    setProjectName("");
  }

  async function createApiKey() {
    if (!projectId) return;
    const res = await fetch(`/api/projects/${projectId}/api-keys`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: apiKeyName }),
    });
    if (!res.ok) return;
    const created = (await res.json()) as ApiKeyCreated;
    setCreatedKey(created);
    setApiKeys((prev) => [created, ...prev]);
    setApiKeyName("");
  }

  async function revokeKey(apiKeyId: string) {
    if (!projectId) return;
    const res = await fetch(`/api/projects/${projectId}/api-keys/${apiKeyId}`, { method: "DELETE" });
    if (!res.ok) return;
    setApiKeys((prev) =>
      prev.map((k) => (k.id === apiKeyId ? { ...k, revoked_at: new Date().toISOString() } : k)),
    );
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Organization</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {orgs.length === 0 ? (
              <div className="grid gap-3">
                <div className="text-sm text-muted-foreground">
                  Create your first organization to start using DevObservatory.
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="orgName">Organization name</Label>
                  <Input id="orgName" value={orgName} onChange={(e) => setOrgName(e.target.value)} />
                </div>
                <Button onClick={createOrg} disabled={!orgName.trim()}>
                  Create organization
                </Button>
              </div>
            ) : (
              <div className="grid gap-2">
                <Label htmlFor="orgSelect">Select organization</Label>
                <select
                  id="orgSelect"
                  value={orgId}
                  onChange={(e) => selectOrg(e.target.value)}
                  className={cn(
                    "h-10 rounded-md border border-input bg-background px-3 text-sm",
                  )}
                >
                  {orgs.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
                <div className="grid gap-2 pt-2">
                  <Label htmlFor="newOrgName">New organization</Label>
                  <div className="flex gap-2">
                    <Input
                      id="newOrgName"
                      placeholder="e.g. Acme Inc"
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                    />
                    <Button onClick={createOrg} disabled={!orgName.trim()}>
                      Create
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Projects</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            {!orgId ? (
              <div className="text-sm text-muted-foreground">Select an organization.</div>
            ) : (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="projectName">New project</Label>
                  <div className="flex gap-2">
                    <Input
                      id="projectName"
                      placeholder="e.g. telemetry-prod"
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                    />
                    <Button onClick={createProject} disabled={!projectName.trim()}>
                      Create
                    </Button>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="projectSelect">Select project</Label>
                  <select
                    id="projectSelect"
                    value={projectId}
                    onChange={(e) => selectProject(e.target.value)}
                    className={cn(
                      "h-10 rounded-md border border-input bg-background px-3 text-sm",
                    )}
                  >
                    <option value="">—</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>API Keys</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          {!selectedProject ? (
            <div className="text-sm text-muted-foreground">Select a project to manage keys.</div>
          ) : (
            <>
              <div className="grid gap-2">
                <Label htmlFor="apiKeyName">New API key</Label>
                <div className="flex gap-2">
                  <Input
                    id="apiKeyName"
                    placeholder="e.g. ingestion"
                    value={apiKeyName}
                    onChange={(e) => setApiKeyName(e.target.value)}
                  />
                  <Button onClick={createApiKey} disabled={!apiKeyName.trim()}>
                    Create
                  </Button>
                </div>
              </div>

              {createdKey ? (
                <div className="rounded-md border p-3">
                  <div className="text-sm font-medium">New API key (copy once)</div>
                  <div className="mt-2 break-all rounded bg-muted p-2 font-mono text-xs">
                    {createdKey.api_key}
                  </div>
                </div>
              ) : null}

              {apiKeys.length === 0 ? (
                <div className="text-sm text-muted-foreground">No API keys yet.</div>
              ) : (
                <ul className="grid gap-2">
                  {apiKeys.map((k) => (
                    <li key={k.id} className="flex items-center justify-between rounded-md border p-3">
                      <div className="grid">
                        <div className="font-medium">{k.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {k.revoked_at ? "Revoked" : "Active"} • Created{" "}
                          {new Date(k.created_at).toLocaleString()}
                        </div>
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => revokeKey(k.id)}
                        disabled={!!k.revoked_at}
                      >
                        Revoke
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
