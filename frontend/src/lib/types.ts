export type TicketStatus = "open" | "in-progress" | "completed" | "skipped";

export type Priority = "very low" | "low" | "default" | "high" | "very high";

export interface Ticket {
  id: number;
  title: string;
  status: TicketStatus;
  date_created: string;
  description?: string;
  related_ticket_ids?: number[];
  due_date?: string;
  priority: Priority;
  est_hours?: number;
  skip_count: number;
}

export interface TicketCreate {
  title: string;
  description?: string;
  related_ticket_ids?: number[];
  due_date?: string;
  priority?: Priority;
  est_hours?: number;
}

export interface TicketUpdate {
  title?: string;
  status?: TicketStatus;
  description?: string;
  related_ticket_ids?: number[];
  due_date?: string;
  priority?: Priority;
  est_hours?: number;
}

export type Frequency = "daily" | "weekly" | "monthly";

export interface RecurringTemplate {
  id: number;
  title: string;
  description?: string;
  priority: Priority;
  est_hours?: number;
  active: boolean;
  frequency: Frequency;
  interval_count: number;
  start_date: string;
  last_fired?: string;
  next_fire?: string;
}

export interface RecurringTemplateCreate {
  title: string;
  description?: string;
  priority?: Priority;
  est_hours?: number;
  active?: boolean;
  frequency: Frequency;
  interval_count?: number;
  start_date: string;
}

export interface RecurringTemplateUpdate {
  title?: string;
  description?: string;
  priority?: Priority;
  est_hours?: number;
  active?: boolean;
  frequency?: Frequency;
  interval_count?: number;
  start_date?: string;
}

export interface QueueStats {
  total: number;
  total_open: number;
  total_in_progress: number;
  total_completed: number;
  total_skipped: number;
}

export interface QueueConfig {
  age_weight: number;
  skip_weight: number;
  effort_weight: number;
  due_date_weight: number;
  overdue_penalty: number;
  priority_very_high: number;
  priority_high: number;
  priority_default: number;
  priority_low: number;
  priority_very_low: number;
}
