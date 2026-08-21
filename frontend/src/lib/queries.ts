import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api } from "./api-client";

export type Org = { id: string; name: string; created_at: string };
export type Project = { id: string; organization_id: string; name: string; created_at: string };
export type ApiKey = {
  id: string;
  project_id: string;
  name: string;
  created_at: string;
  revoked_at: string | null;
  last_used_at: string | null;
};
export type ApiKeyCreated = ApiKey & { api_key: string };
export type EventRecord = {
  id: number;
  project_id: string;
  event_name: string;
  user_id: string | null;
  timestamp: string;
  properties: Record<string, unknown>;
  received_at: string;
};
export type Metrics = {
  total_events: number;
  events_per_minute: number;
  active_projects: number;
};
export type Me = { id: string; email: string; name: string | null; created_at: string };

export type TimeBucket = { bucket: string; count: number };
export type TopEvent = { event_name: string; count: number };
export type Analytics = { timeseries: TimeBucket[]; top_events: TopEvent[] };

export type ShareToken = { token: string; expires_at: string };

export type Funnel = {
  id: string;
  project_id: string;
  name: string;
  steps: string[];
  created_at: string;
};
export type FunnelStepResult = {
  event_name: string;
  reached: number;
  conversion_rate: number;
};
export type FunnelResult = {
  funnel_id: string;
  window_hours: number;
  steps: FunnelStepResult[];
};

export type EventFilters = {
  event_name?: string;
  user_id?: string;
  from?: string; // ISO datetime
  to?: string;
  limit?: number;
  cursor?: string;
};

export type EventSearchResult = {
  events: EventRecord[];
  has_more: boolean;
  next_cursor: string | null;
};

export const queryKeys = {
  me: ["auth", "me"] as const,
  orgs: ["orgs"] as const,
  projects: (orgId: string | null) => ["orgs", orgId, "projects"] as const,
  apiKeys: (projectId: string | null) =>
    ["projects", projectId, "api-keys"] as const,
  events: (projectId: string | null) => ["projects", projectId, "events"] as const,
  eventSearch: (projectId: string | null, filters: EventFilters) =>
    ["projects", projectId, "events", "search", filters] as const,
  analytics: (projectId: string | null) => ["projects", projectId, "analytics"] as const,
  funnels: (projectId: string | null) => ["projects", projectId, "funnels"] as const,
  funnelResult: (projectId: string | null, funnelId: string | null, hours: number) =>
    ["projects", projectId, "funnels", funnelId, "result", hours] as const,
  metrics: ["metrics", "overview"] as const,
};

export function useMe() {
  return useQuery({ queryKey: queryKeys.me, queryFn: () => api.get<Me>("/api/auth/me") });
}

export function useOrgs() {
  return useQuery({ queryKey: queryKeys.orgs, queryFn: () => api.get<Org[]>("/api/orgs") });
}

export function useCreateOrg() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api.post<Org>("/api/orgs", { name }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.orgs }),
  });
}

export function useProjects(orgId: string | null) {
  return useQuery({
    queryKey: queryKeys.projects(orgId),
    queryFn: () => api.get<Project[]>(`/api/orgs/${orgId}/projects`),
    enabled: !!orgId,
  });
}

export function useCreateProject(orgId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api.post<Project>(`/api/orgs/${orgId}/projects`, { name }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.projects(orgId) }),
  });
}

export function useApiKeys(projectId: string | null) {
  return useQuery({
    queryKey: queryKeys.apiKeys(projectId),
    queryFn: () => api.get<ApiKey[]>(`/api/projects/${projectId}/api-keys`),
    enabled: !!projectId,
  });
}

export function useCreateApiKey(projectId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      api.post<ApiKeyCreated>(`/api/projects/${projectId}/api-keys`, { name }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.apiKeys(projectId) }),
  });
}

export function useRevokeApiKey(projectId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (apiKeyId: string) =>
      api.delete<void>(`/api/projects/${projectId}/api-keys/${apiKeyId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.apiKeys(projectId) }),
  });
}

export function useEvents(projectId: string | null) {
  return useQuery({
    queryKey: queryKeys.events(projectId),
    queryFn: () => api.get<EventRecord[]>(`/api/projects/${projectId}/events`),
    enabled: !!projectId,
  });
}

function buildSearchQuery(filters: EventFilters): string {
  const params = new URLSearchParams();
  if (filters.event_name) params.set("event_name", filters.event_name);
  if (filters.user_id) params.set("user_id", filters.user_id);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.limit) params.set("limit", String(filters.limit));
  if (filters.cursor) params.set("cursor", filters.cursor);
  const s = params.toString();
  return s ? `?${s}` : "";
}

export function useEventSearch(projectId: string | null, filters: EventFilters) {
  return useQuery({
    queryKey: queryKeys.eventSearch(projectId, filters),
    queryFn: () =>
      api.get<EventSearchResult>(
        `/api/projects/${projectId}/events/search${buildSearchQuery(filters)}`,
      ),
    enabled: !!projectId,
  });
}

export function useAnalytics(projectId: string | null) {
  return useQuery({
    queryKey: queryKeys.analytics(projectId),
    queryFn: () => api.get<Analytics>(`/api/projects/${projectId}/analytics`),
    enabled: !!projectId,
    refetchInterval: 30_000,
  });
}

export function useFunnels(projectId: string | null) {
  return useQuery({
    queryKey: queryKeys.funnels(projectId),
    queryFn: () => api.get<Funnel[]>(`/api/projects/${projectId}/funnels`),
    enabled: !!projectId,
  });
}

export function useCreateFunnel(projectId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; steps: string[] }) =>
      api.post<Funnel>(`/api/projects/${projectId}/funnels`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.funnels(projectId) }),
  });
}

export function useDeleteFunnel(projectId: string | null) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (funnelId: string) =>
      api.delete<void>(`/api/projects/${projectId}/funnels/${funnelId}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.funnels(projectId) }),
  });
}

export function useFunnelResult(
  projectId: string | null,
  funnelId: string | null,
  windowHours: number = 24,
) {
  return useQuery({
    queryKey: queryKeys.funnelResult(projectId, funnelId, windowHours),
    queryFn: () =>
      api.get<FunnelResult>(
        `/api/projects/${projectId}/funnels/${funnelId}/result?window_hours=${windowHours}`,
      ),
    enabled: !!projectId && !!funnelId,
  });
}

export function useCreateShareToken(projectId: string | null) {
  return useMutation({
    mutationFn: () => api.post<ShareToken>(`/api/projects/${projectId}/share-tokens`, {}),
  });
}

export function useSeedDemo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ org_id: string; project_id: string; api_key: string | null }>("/api/demo/seed", {}),
    onSuccess: () => {
      qc.invalidateQueries();
    },
  });
}

export function useMetrics() {
  return useQuery({ queryKey: queryKeys.metrics, queryFn: () => api.get<Metrics>("/api/metrics/overview") });
}