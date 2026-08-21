"use client";

import { useEffect, useState } from "react";
import { Copy, Eye, EyeOff, Share2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ApiError } from "@/lib/api-client";
import { ingestSnippet, type SdkLanguage } from "@/lib/snippets";
import {
  useApiKeys,
  useCreateApiKey,
  useCreateOrg,
  useCreateProject,
  useCreateShareToken,
  useOrgs,
  useProjects,
  useRevokeApiKey,
} from "@/lib/queries";
import { useSelectorStore } from "@/components/app/selector-store";
import type { ApiKeyCreated } from "@/lib/queries";

export default function ProjectsPage() {
  const orgId = useSelectorStore((s) => s.orgId);
  const projectId = useSelectorStore((s) => s.projectId);
  const setOrg = useSelectorStore((s) => s.setOrg);
  const setProject = useSelectorStore((s) => s.setProject);

  const orgs = useOrgs();
  const projects = useProjects(orgId);
  const apiKeys = useApiKeys(projectId);

  const createOrg = useCreateOrg();
    const createProject = useCreateProject(orgId);
    const createApiKey = useCreateApiKey(projectId);
    const revokeApiKey = useRevokeApiKey(projectId);
    const createShareToken = useCreateShareToken(projectId);

  const [orgName, setOrgName] = useState("");
  const [projectName, setProjectName] = useState("");
  const [apiKeyName, setApiKeyName] = useState("");

  const [createdKey, setCreatedKey] = useState<ApiKeyCreated | null>(null);
    const [revealedKey, setRevealedKey] = useState(false);
    const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [snippetLang, setSnippetLang] = useState<SdkLanguage>("curl");
  const [snippetEventName, setSnippetEventName] = useState("user_signup");

  // Auto-select first org/project if missing
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

  function handleApiError(err: unknown, fallback: string) {
    const detail = err instanceof ApiError ? err.detail : fallback;
    toast.error(detail);
  }

  async function onCreateOrg() {
    if (!orgName.trim()) return;
    try {
      const created = await createOrg.mutateAsync(orgName.trim());
      setOrg(created.id);
      setOrgName("");
      toast.success("Organization created");
    } catch (err) {
      handleApiError(err, "Could not create organization");
    }
  }

  async function onCreateProject() {
    if (!projectName.trim()) return;
    try {
      const created = await createProject.mutateAsync(projectName.trim());
      setProject(created.id);
      setProjectName("");
      toast.success("Project created");
    } catch (err) {
      handleApiError(err, "Could not create project");
    }
  }

  async function onCreateApiKey() {
    if (!apiKeyName.trim()) return;
    try {
      const created = await createApiKey.mutateAsync(apiKeyName.trim());
      setCreatedKey(created);
      setApiKeyName("");
      setRevealedKey(true);
      toast.success("API key created — copy it now");
    } catch (err) {
      handleApiError(err, "Could not create API key");
    }
  }

  async function onRevoke(keyId: string) {
    try {
      await revokeApiKey.mutateAsync(keyId);
      toast.success("API key revoked");
    } catch (err) {
      handleApiError(err, "Could not revoke API key");
    }
  }

  async function copyToClipboard(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
    } catch {
      toast.error("Clipboard unavailable");
    }
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Organizations</CardTitle>
          <CardDescription>Group projects you want to track together.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex flex-wrap items-end gap-2">
            <div className="grid grow gap-1">
              <Label htmlFor="org-select-existing">Existing</Label>
              <Select value={orgId ?? ""} onValueChange={(v) => setOrg(v)}>
                <SelectTrigger id="org-select-existing">
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
            <div className="grid grow gap-1">
              <Label htmlFor="org-name">New organization</Label>
              <Input
                id="org-name"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                placeholder="e.g. Acme"
              />
            </div>
            <Button onClick={onCreateOrg} disabled={!orgName.trim() || createOrg.isPending}>
              {createOrg.isPending ? "Creating…" : "Create"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Projects</CardTitle>
          <CardDescription>Each project gets its own API keys and event stream.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex flex-wrap items-end gap-2">
            <div className="grid grow gap-1">
              <Label htmlFor="project-select-existing">Existing</Label>
              <Select
                value={projectId ?? ""}
                onValueChange={(v) => setProject(v)}
                disabled={!orgId || (projects.data?.length ?? 0) === 0}
              >
                <SelectTrigger id="project-select-existing">
                  <SelectValue placeholder={orgId ? "Select project" : "Pick an organization"} />
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
            <div className="grid grow gap-1">
              <Label htmlFor="project-name">New project</Label>
              <Input
                id="project-name"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="e.g. web-app"
                disabled={!orgId}
              />
            </div>
            <Button
              onClick={onCreateProject}
              disabled={!orgId || !projectName.trim() || createProject.isPending}
            >
              {createProject.isPending ? "Creating…" : "Create"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>API keys</CardTitle>
          <CardDescription>
            Send events with <code className="font-mono text-xs">X-API-Key: &lt;key&gt;</code> at
            <code className="font-mono text-xs"> POST /api/events</code>.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex flex-wrap items-end gap-2">
            <div className="grid grow gap-1">
              <Label htmlFor="api-key-name">New key name</Label>
              <Input
                id="api-key-name"
                value={apiKeyName}
                onChange={(e) => setApiKeyName(e.target.value)}
                placeholder="e.g. production-ingest"
                disabled={!projectId}
              />
            </div>
            <Button onClick={onCreateApiKey} disabled={!projectId || !apiKeyName.trim() || createApiKey.isPending}>
              {createApiKey.isPending ? "Creating…" : "Create key"}
            </Button>
          </div>

          {apiKeys.isLoading ? (
            <div className="text-sm text-muted-foreground">Loading keys…</div>
          ) : !apiKeys.data || apiKeys.data.length === 0 ? (
            <div className="text-sm text-muted-foreground">No API keys yet.</div>
          ) : (
            <ul className="grid gap-2">
              {apiKeys.data.map((k) => (
                <li
                  key={k.id}
                  className="flex items-center justify-between rounded-md border p-3 text-sm"
                >
                  <div>
                    <div className="font-medium">{k.name}</div>
                    <div className="text-xs text-muted-foreground">
                      created {new Date(k.created_at).toLocaleString()}
                      {k.last_used_at
                        ? ` · last used ${new Date(k.last_used_at).toLocaleString()}`
                        : ""}
                      {k.revoked_at ? " · revoked" : ""}
                    </div>
                  </div>
                  {!k.revoked_at ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onRevoke(k.id)}
                      disabled={revokeApiKey.isPending}
                    >
                      Revoke
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Share</CardTitle>
          <CardDescription>
            Mint a public, read-only URL for this project's dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            disabled={!projectId || createShareToken.isPending}
            onClick={async () => {
              try {
                const out = await createShareToken.mutateAsync();
                const url = `${window.location.origin}/share/${out.token}`;
                setShareUrl(url);
                toast.success("Share link created (30 days)");
              } catch (err) {
                handleApiError(err, "Could not create share link");
              }
            }}
          >
            <Share2 className="mr-2 h-4 w-4" />
            Create share link
          </Button>
        </CardContent>
      </Card>

      <Dialog open={!!shareUrl} onOpenChange={(open) => !open && setShareUrl(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Share link</DialogTitle>
            <DialogDescription>
              Anyone with this link can view a read-only dashboard for this project for the next
              30 days.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <code className="grow overflow-x-auto rounded bg-muted px-3 py-2 font-mono text-xs">
              {shareUrl}
            </code>
            <Button
              variant="outline"
              size="icon"
              onClick={() => shareUrl && copyToClipboard(shareUrl, "Share link")}
              aria-label="Copy share link"
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShareUrl(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!createdKey}
        onOpenChange={(open) => {
          if (!open) {
            setCreatedKey(null);
            setRevealedKey(false);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save your new API key</DialogTitle>
            <DialogDescription>
              This is the only time the full key will be shown. Copy it somewhere safe before closing
              this dialog.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2">
            <Label>Name</Label>
            <div className="text-sm">{createdKey?.name}</div>

            <Label>Key</Label>
            <div className="flex items-center gap-2">
              <code className="grow overflow-x-auto rounded bg-muted px-3 py-2 font-mono text-xs">
                {revealedKey ? createdKey?.api_key : "•".repeat(40)}
              </code>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setRevealedKey((v) => !v)}
                    aria-label={revealedKey ? "Hide key" : "Reveal key"}
                  >
                    {revealedKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{revealedKey ? "Hide" : "Reveal"}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => createdKey && copyToClipboard(createdKey.api_key, "API key")}
                    aria-label="Copy key"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Copy</TooltipContent>
              </Tooltip>
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Try it now</Label>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={snippetLang} onValueChange={(v) => setSnippetLang(v as SdkLanguage)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="curl">cURL</SelectItem>
                  <SelectItem value="node">Node.js</SelectItem>
                  <SelectItem value="python">Python</SelectItem>
                  <SelectItem value="go">Go</SelectItem>
                </SelectContent>
              </Select>
              <Input
                value={snippetEventName}
                onChange={(e) => setSnippetEventName(e.target.value)}
                placeholder="event_name"
                className="w-44"
              />
            </div>
            <pre className="max-h-48 overflow-auto rounded bg-muted p-3 text-xs">
              <code>{ingestSnippet(snippetLang, createdKey?.api_key ?? "<api-key>", snippetEventName)}</code>
            </pre>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                createdKey &&
                copyToClipboard(
                  ingestSnippet(snippetLang, createdKey.api_key, snippetEventName),
                  "Snippet",
                )
              }
              disabled={!createdKey}
            >
              <Copy className="mr-2 h-4 w-4" />
              Copy snippet
            </Button>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreatedKey(null)}>
              I've saved it
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}