export type TicketStatus = "open" | "in-progress" | "completed" | "skipped";

export type Priority = "very low" | "low" | "default" | "high" | "very high";

export type CustomAttributeType = "text" | "number" | "boolean" | "date";

export interface CustomAttribute {
  name: string;
  type: CustomAttributeType;
  goal?: string | number | boolean | null;
  current?: string | number | boolean | null;
}

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
  profile_id?: number;
  custom_attributes?: CustomAttribute[];
}

export interface TicketCreate {
  title: string;
  description?: string;
  related_ticket_ids?: number[];
  due_date?: string;
  priority?: Priority;
  est_hours?: number;
  profile_id?: number;
  custom_attributes?: CustomAttribute[];
}

export interface TicketUpdate {
  title?: string;
  status?: TicketStatus;
  description?: string;
  related_ticket_ids?: number[];
  due_date?: string;
  priority?: Priority;
  est_hours?: number;
  profile_id?: number;
  custom_attributes?: CustomAttribute[];
}

export type Frequency = "daily" | "weekly" | "monthly";

export interface RecurringTemplate {
  id: number;
  title: string;
  description?: string;
  priority: Priority;
  est_hours?: number;
  due_in_days?: number;
  active: boolean;
  frequency: Frequency;
  interval_count: number;
  start_date: string;
  last_fired?: string;
  next_fire?: string;
  profile_id?: number;
  custom_attributes?: CustomAttribute[];
}

export interface RecurringTemplateCreate {
  title: string;
  description?: string;
  priority?: Priority;
  est_hours?: number;
  due_in_days?: number;
  active?: boolean;
  frequency: Frequency;
  interval_count?: number;
  start_date: string;
  profile_id?: number;
  custom_attributes?: CustomAttribute[];
}

export interface RecurringTemplateUpdate {
  title?: string;
  description?: string;
  priority?: Priority;
  est_hours?: number;
  due_in_days?: number;
  active?: boolean;
  frequency?: Frequency;
  interval_count?: number;
  start_date?: string;
  profile_id?: number;
  custom_attributes?: CustomAttribute[];
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

export interface Profile {
  id: number;
  name: string;
  color: string;
  imap_host?: string;
  imap_port?: number;
  imap_user?: string;
  imap_use_ssl: boolean;
  email_enabled: boolean;
  has_password: boolean;
}

export interface ProfileCreate {
  name: string;
  color?: string;
}

export interface ProfileUpdate {
  name?: string;
  color?: string;
  imap_host?: string;
  imap_port?: number;
  imap_user?: string;
  imap_password?: string;
  imap_use_ssl?: boolean;
  email_enabled?: boolean;
}

export interface User {
  id: number;
  username: string;
  role: "admin" | "user";
  is_active: boolean;
  created_at: string;
}

// Gamification types

export interface GameStats {
  gamification_enabled: boolean;
  total_xp: number;
  current_level: number;
  xp_for_current_level: number;
  xp_for_next_level: number;
  xp_progress: number;
  rank_title: string;
  current_streak: number;
  longest_streak: number;
  streak_shield_available: boolean;
  combo_count: number;
  total_completed: number;
  total_skipped: number;
  completion_rate: number;
  tickets_completed_today: number;
  achievements: Achievement[];
  daily_challenges: Challenge[];
  weekly_challenge: Challenge | null;
}

export interface Achievement {
  id: string;
  name: string;
  description: string;
  xp: number;
  unlocked: boolean;
}

export interface Challenge {
  id: string;
  name: string;
  description: string;
  target: number;
  xp: number;
  progress: number;
  completed?: boolean;
}

export interface GameEvent {
  xp_earned: number;
  xp_breakdown: Record<string, number>;
  new_total_xp: number;
  level: number;
  leveled_up: boolean;
  new_level?: number;
  rank_title: string;
  streak: number;
  combo: number;
  new_achievements: { id: string; name: string; description: string; xp: number }[];
  challenge_progress: { name: string; progress: number; target: number; completed: boolean }[];
}

export interface SkipGameEvent {
  xp_lost: number;
  new_total_xp: number;
  level: number;
  rank_title: string;
  combo_reset: boolean;
  weekly_skips: number;
}
