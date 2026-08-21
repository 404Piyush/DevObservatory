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

export const queryKeys = {
  me: ["auth", "me"] as const,
  orgs: ["orgs"] as const,
  projects: (orgId: string | null) => ["orgs", orgId, "projects"] as const,
  apiKeys: (projectId: string | null) =>
    ["projects", projectId, "api-keys"] as const,
  events: (projectId: string | null) => ["projects", projectId, "events"] as const,
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

export function useMetrics() {
  return useQuery({ queryKey: queryKeys.metrics, queryFn: () => api.get<Metrics>("/api/metrics/overview") });
}