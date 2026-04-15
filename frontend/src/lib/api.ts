import {
  Ticket,
  TicketCreate,
  TicketUpdate,
  RecurringTemplate,
  RecurringTemplateCreate,
  RecurringTemplateUpdate,
  QueueStats,
  QueueConfig,
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
}): Promise<Ticket[]> {
  const sp = new URLSearchParams();
  if (params?.status) sp.set("status", params.status);
  if (params?.priority) sp.set("priority", params.priority);
  if (params?.sort_by) sp.set("sort_by", params.sort_by);
  if (params?.sort_order) sp.set("sort_order", params.sort_order);
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
export async function getNextTicket(): Promise<Ticket | null> {
  try {
    return await request<Ticket>("/api/queue/next");
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

export async function getQueueStats(): Promise<QueueStats> {
  return request<QueueStats>("/api/queue/stats");
}

// Recurring Templates
export async function listRecurring(): Promise<RecurringTemplate[]> {
  return request<RecurringTemplate[]>("/api/recurring");
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
