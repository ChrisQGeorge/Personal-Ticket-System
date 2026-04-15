import {
  Ticket,
  TicketCreate,
  TicketUpdate,
  RecurringTemplate,
  RecurringTemplateCreate,
  RecurringTemplateUpdate,
  QueueStats,
  QueueConfig,
  Profile,
  ProfileCreate,
  ProfileUpdate,
} from "./types";

const BASE = process.env.NEXT_PUBLIC_API_URL || "";

async function request<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `API error ${res.status}: ${text || res.statusText}`
    );
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// Tickets
export async function listTickets(params?: {
  status?: string;
  priority?: string;
  sort_by?: string;
  sort_order?: string;
  profile_id?: number;
}): Promise<Ticket[]> {
  const sp = new URLSearchParams();
  if (params?.status) sp.set("status", params.status);
  if (params?.priority) sp.set("priority", params.priority);
  if (params?.sort_by) sp.set("sort_by", params.sort_by);
  if (params?.sort_order) sp.set("sort_order", params.sort_order);
  if (params?.profile_id != null) sp.set("profile_id", String(params.profile_id));
  const qs = sp.toString();
  return request<Ticket[]>(`/api/tickets${qs ? `?${qs}` : ""}`);
}

export async function getTicket(id: number): Promise<Ticket> {
  return request<Ticket>(`/api/tickets/${id}`);
}

export async function createTicket(data: TicketCreate): Promise<Ticket> {
  return request<Ticket>("/api/tickets", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateTicket(
  id: number,
  data: TicketUpdate
): Promise<Ticket> {
  return request<Ticket>(`/api/tickets/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteTicket(id: number): Promise<void> {
  return request<void>(`/api/tickets/${id}`, { method: "DELETE" });
}

// Queue
export async function getNextTicket(profileId?: number): Promise<Ticket | null> {
  try {
    const qs = profileId != null ? `?profile_id=${profileId}` : "";
    return await request<Ticket>(`/api/queue/next${qs}`);
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes("404")) return null;
    throw e;
  }
}

export async function completeTicket(id: number): Promise<Ticket | null> {
  try {
    return await request<Ticket>(`/api/queue/complete/${id}`, {
      method: "POST",
    });
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes("404")) return null;
    throw e;
  }
}

export async function skipTicket(id: number): Promise<Ticket | null> {
  try {
    return await request<Ticket>(`/api/queue/skip/${id}`, {
      method: "POST",
    });
  } catch (e: unknown) {
    if (e instanceof Error && e.message.includes("404")) return null;
    throw e;
  }
}

export async function getQueueStats(profileId?: number): Promise<QueueStats> {
  const qs = profileId != null ? `?profile_id=${profileId}` : "";
  return request<QueueStats>(`/api/queue/stats${qs}`);
}

// Recurring Templates
export async function listRecurring(profileId?: number): Promise<RecurringTemplate[]> {
  const qs = profileId != null ? `?profile_id=${profileId}` : "";
  return request<RecurringTemplate[]>(`/api/recurring${qs}`);
}

export async function getRecurring(id: number): Promise<RecurringTemplate> {
  return request<RecurringTemplate>(`/api/recurring/${id}`);
}

export async function createRecurring(
  data: RecurringTemplateCreate
): Promise<RecurringTemplate> {
  return request<RecurringTemplate>("/api/recurring", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateRecurring(
  id: number,
  data: RecurringTemplateUpdate
): Promise<RecurringTemplate> {
  return request<RecurringTemplate>(`/api/recurring/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteRecurring(id: number): Promise<void> {
  return request<void>(`/api/recurring/${id}`, { method: "DELETE" });
}

// Config
export async function getQueueConfig(): Promise<QueueConfig> {
  return request<QueueConfig>("/api/config");
}

export async function updateQueueConfig(
  data: Partial<QueueConfig>
): Promise<QueueConfig> {
  return request<QueueConfig>("/api/config", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function resetQueueConfig(): Promise<QueueConfig> {
  return request<QueueConfig>("/api/config/reset", {
    method: "POST",
  });
}

// Import
export async function importTickets(file: File, profileId?: number): Promise<{ imported: number; errors: { row: number; error: string }[] }> {
  const formData = new FormData();
  formData.append("file", file);
  if (profileId != null) formData.append("profile_id", String(profileId));
  const res = await fetch("/api/import", {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API error ${res.status}: ${text || res.statusText}`);
  }
  return res.json();
}

export function getTemplateUrl(): string {
  return "/api/import/template";
}

// Profiles
export async function listProfiles(): Promise<Profile[]> {
  return request<Profile[]>("/api/profiles");
}

export async function createProfile(data: ProfileCreate): Promise<Profile> {
  return request<Profile>("/api/profiles", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getProfile(id: number): Promise<Profile> {
  return request<Profile>(`/api/profiles/${id}`);
}

export async function updateProfile(id: number, data: ProfileUpdate): Promise<Profile> {
  return request<Profile>(`/api/profiles/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function deleteProfile(id: number): Promise<void> {
  return request<void>(`/api/profiles/${id}`, { method: "DELETE" });
}

export async function testProfileEmail(id: number): Promise<{ success: boolean; message: string }> {
  return request<{ success: boolean; message: string }>(`/api/profiles/${id}/test-email`, {
    method: "POST",
  });
}

// Backup
export function getBackupUrl(): string {
  return "/api/backup";
}

export async function restoreBackup(file: File): Promise<{
  restored: boolean;
  profiles: number;
  tickets: number;
  recurring_templates: number;
  ticket_relationships: number;
}> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch("/api/backup/restore", {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API error ${res.status}: ${text || res.statusText}`);
  }
  return res.json();
}
