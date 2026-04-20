"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { Ticket, GameStats, GameEvent, SkipGameEvent, CustomAttribute } from "@/lib/types";
import {
  getNextTicket,
  completeTicket,
  skipTicket,
  getGameStats,
  updateTicket,
} from "@/lib/api";
import { useProfile } from "@/lib/profile-context";
import GameEventToast from "@/components/GameEventToast";

export default function QueuePage() {
  const { activeProfile } = useProfile();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState("");
  const [empty, setEmpty] = useState(false);

  // Editable fields (local state, synced to ticket on load)
  const [editDescription, setEditDescription] = useState("");
  const [editHours, setEditHours] = useState("");
  const [editAttrs, setEditAttrs] = useState<CustomAttribute[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Gamification state
  const [gameStats, setGameStats] = useState<GameStats | null>(null);
  const [gameEvent, setGameEvent] = useState<GameEvent | SkipGameEvent | null>(null);

  const loadNext = useCallback(async () => {
    setLoading(true);
    setError("");
    setEmpty(false);
    setSaveSuccess(false);
    try {
      const t = await getNextTicket(activeProfile?.id);
      if (t) {
        setTicket(t);
        setEditDescription(t.description ?? "");
        setEditHours(t.est_hours != null ? String(t.est_hours) : "");
        setEditAttrs(t.custom_attributes ?? []);
      } else {
        setTicket(null);
        setEmpty(true);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load queue");
    } finally {
      setLoading(false);
    }
  }, [activeProfile?.id]);

  const loadGameStats = useCallback(() => {
    getGameStats()
      .then(setGameStats)
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadNext();
    loadGameStats();
  }, [loadNext, loadGameStats]);

  // Detect if any fields are dirty vs. the loaded ticket
  const isDirty = (() => {
    if (!ticket) return false;
    if (editDescription !== (ticket.description ?? "")) return true;
    const ticketHoursStr = ticket.est_hours != null ? String(ticket.est_hours) : "";
    if (editHours !== ticketHoursStr) return true;
    if (JSON.stringify(editAttrs) !== JSON.stringify(ticket.custom_attributes ?? [])) return true;
    return false;
  })();

  async function handleSaveEdits() {
    if (!ticket || !isDirty) return;
    setSaving(true);
    setError("");
    setSaveSuccess(false);
    try {
      const updated = await updateTicket(ticket.id, {
        description: editDescription || null,
        est_hours: editHours ? parseFloat(editHours) : null,
        custom_attributes: editAttrs,
      });
      setTicket(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to save changes");
    } finally {
      setSaving(false);
    }
  }

  async function handleComplete() {
    if (!ticket) return;
    setActing(true);
    setError("");
    try {
      // Save edits first if any are pending
      if (isDirty) {
        await updateTicket(ticket.id, {
          description: editDescription || null,
          est_hours: editHours ? parseFloat(editHours) : null,
          custom_attributes: editAttrs,
        });
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result: any = await completeTicket(ticket.id);
      if (result?.game_event) {
        setGameEvent(result.game_event as GameEvent);
        loadGameStats();
      }
      const next = await getNextTicket(activeProfile?.id);
      if (next) {
        setTicket(next);
        setEditDescription(next.description ?? "");
        setEditHours(next.est_hours != null ? String(next.est_hours) : "");
        setEditAttrs(next.custom_attributes ?? []);
      } else {
        setTicket(null);
        setEmpty(true);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to complete ticket");
    } finally {
      setActing(false);
    }
  }

  async function handleSkip() {
    if (!ticket) return;
    setActing(true);
    setError("");
    try {
      // Save edits first if any are pending
      if (isDirty) {
        await updateTicket(ticket.id, {
          description: editDescription || null,
          est_hours: editHours ? parseFloat(editHours) : null,
          custom_attributes: editAttrs,
        });
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result: any = await skipTicket(ticket.id);
      if (result?.game_event) {
        setGameEvent(result.game_event as SkipGameEvent);
        loadGameStats();
      }
      const next = await getNextTicket(activeProfile?.id);
      if (next) {
        setTicket(next);
        setEditDescription(next.description ?? "");
        setEditHours(next.est_hours != null ? String(next.est_hours) : "");
        setEditAttrs(next.custom_attributes ?? []);
      } else {
        setTicket(null);
        setEmpty(true);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to skip ticket");
    } finally {
      setActing(false);
    }
  }

  function updateAttr(index: number, patch: Partial<CustomAttribute>) {
    setEditAttrs((prev) => prev.map((a, i) => (i === index ? { ...a, ...patch } : a)));
  }

  const gamificationEnabled = gameStats?.gamification_enabled;

  if (loading) {
    return <p className="text-sm text-gray-400">Loading queue...</p>;
  }

  if (error && !ticket) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold text-gray-900">Work Queue</h1>
        <p className="text-sm text-red-500">{error}</p>
        <button
          onClick={loadNext}
          className="min-h-[44px] rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (empty || !ticket) {
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Work Queue</h1>
        <div className="mx-auto max-w-sm rounded-lg border border-gray-200 bg-white p-8 shadow-sm">
          <p className="text-lg text-gray-600">No tickets in queue!</p>
          <p className="mt-1 text-sm text-gray-400">Create one to get started.</p>
          <Link
            href="/tickets/new"
            className="mt-4 inline-block min-h-[44px] rounded-md bg-indigo-600 px-6 py-3 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
          >
            Create Ticket
          </Link>
        </div>
      </div>
    );
  }

  const priorityColors: Record<string, string> = {
    "very low": "text-gray-500",
    low: "text-blue-600",
    default: "text-gray-700",
    high: "text-orange-600",
    "very high": "text-red-600 font-semibold",
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Work Queue</h1>

      <GameEventToast event={gameEvent} onDismiss={() => setGameEvent(null)} />

      {gamificationEnabled && gameStats && (
        <div className="mx-auto flex max-w-2xl items-center justify-center gap-4 rounded-lg border border-purple-200 bg-gradient-to-r from-purple-50 to-indigo-50 px-4 py-2 text-sm">
          <span className="font-semibold text-purple-700">Lv.{gameStats.current_level}</span>
          <span className="text-gray-400">|</span>
          {gameStats.current_streak > 0 && (
            <>
              <span className="flex items-center gap-1 text-orange-600">
                {gameStats.current_streak >= 3 ? "\uD83D\uDD25" : ""} {gameStats.current_streak} streak
              </span>
              <span className="text-gray-400">|</span>
            </>
          )}
          {gameStats.combo_count > 0 && (
            <>
              <span className="flex items-center gap-1 text-blue-600">
                {"\u26A1"} {gameStats.combo_count}x combo
              </span>
              <span className="text-gray-400">|</span>
            </>
          )}
          <span className="font-medium text-amber-600">{gameStats.total_xp.toLocaleString()} XP</span>
        </div>
      )}

      <div className="mx-auto max-w-2xl rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        {/* Header */}
        <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <h2 className="text-xl font-semibold text-gray-900">
            <span className="mr-1 text-gray-400">#{ticket.id}</span>
            {ticket.title}
          </h2>
          <Link href={`/tickets/${ticket.id}`} className="text-xs text-indigo-600 hover:underline">
            Full Edit
          </Link>
        </div>

        {/* Details grid */}
        <div className="mb-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
          <div>
            <span className="font-medium text-gray-500">Priority</span>
            <div className={priorityColors[ticket.priority] ?? ""}>{ticket.priority}</div>
          </div>
          <div>
            <span className="font-medium text-gray-500">Status</span>
            <div>{ticket.status}</div>
          </div>
          <div>
            <span className="font-medium text-gray-500">Skip Count</span>
            <div>{ticket.skip_count}</div>
          </div>
          {ticket.due_date && (
            <div>
              <span className="font-medium text-gray-500">Due Date</span>
              <div>{ticket.due_date}</div>
            </div>
          )}
          <div>
            <span className="mb-1 block font-medium text-gray-500">Est. Hours</span>
            <input
              type="number"
              min="0"
              step="0.25"
              value={editHours}
              onChange={(e) => setEditHours(e.target.value)}
              placeholder="—"
              className="w-full max-w-[120px] rounded-md border border-gray-300 px-2 py-1 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <span className="font-medium text-gray-500">Created</span>
            <div>{new Date(ticket.date_created).toLocaleDateString()}</div>
          </div>
        </div>

        {/* Description (editable) */}
        <div className="mb-4 rounded-md bg-gray-50 p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Description / Notes
          </h3>
          <textarea
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            placeholder="Add notes or description..."
            rows={4}
            className="w-full resize-y rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* Custom Attributes (editable) */}
        {editAttrs.length > 0 && (
          <div className="mb-4 rounded-md bg-gray-50 p-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
              Attributes
            </h3>
            <div className="space-y-3">
              {editAttrs.map((a, i) => {
                const isNumber = a.type === "number";
                const goal = typeof a.goal === "number" ? a.goal : 0;
                const current = typeof a.current === "number" ? a.current : 0;
                const progress = isNumber && goal > 0 ? Math.min(100, (current / goal) * 100) : 0;

                return (
                  <div key={i} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-gray-700">{a.name}</span>
                      {isNumber && (
                        <span className="text-xs text-gray-500 tabular-nums">
                          {current} / {goal}
                        </span>
                      )}
                    </div>
                    {isNumber ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => updateAttr(i, { current: Math.max(0, current - 1) })}
                          className="min-h-[32px] min-w-[32px] rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-100"
                        >
                          −
                        </button>
                        <input
                          type="number"
                          step="any"
                          value={current}
                          onChange={(e) => updateAttr(i, { current: parseFloat(e.target.value) || 0 })}
                          className="w-20 rounded-md border border-gray-300 px-2 py-1 text-center text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                        <button
                          type="button"
                          onClick={() => updateAttr(i, { current: current + 1 })}
                          className="min-h-[32px] min-w-[32px] rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-100"
                        >
                          +
                        </button>
                        <div className="ml-2 h-2 flex-1 overflow-hidden rounded-full bg-gray-200">
                          <div
                            className="h-full bg-indigo-500 transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    ) : a.type === "boolean" ? (
                      <button
                        type="button"
                        onClick={() => updateAttr(i, { current: !a.current })}
                        className={`min-h-[32px] rounded-md px-4 py-1 text-sm font-medium transition-colors ${
                          a.current
                            ? "bg-green-100 text-green-700 hover:bg-green-200"
                            : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                        }`}
                      >
                        {a.current ? "Yes" : "No"}
                      </button>
                    ) : a.type === "date" ? (
                      <input
                        type="date"
                        value={typeof a.current === "string" ? a.current : ""}
                        onChange={(e) => updateAttr(i, { current: e.target.value })}
                        className="rounded-md border border-gray-300 px-2 py-1 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    ) : (
                      <input
                        type="text"
                        value={a.current == null ? "" : String(a.current)}
                        onChange={(e) => updateAttr(i, { current: e.target.value })}
                        placeholder={a.goal != null ? `Goal: ${a.goal}` : ""}
                        className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Save bar (only shown when dirty) */}
        {isDirty && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-md bg-amber-50 px-4 py-2 text-sm">
            <span className="text-amber-800">You have unsaved changes.</span>
            <button
              onClick={handleSaveEdits}
              disabled={saving}
              className="min-h-[36px] rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        )}

        {saveSuccess && (
          <div className="mb-4 rounded-md bg-green-50 px-4 py-2 text-sm text-green-700">
            ✓ Changes saved
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            onClick={handleComplete}
            disabled={acting}
            className="min-h-[52px] flex-1 rounded-lg bg-emerald-600 px-6 py-3 text-base font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:opacity-50"
          >
            {acting ? "Processing..." : "Complete"}
          </button>
          <button
            onClick={handleSkip}
            disabled={acting}
            className="min-h-[52px] flex-1 rounded-lg bg-amber-500 px-6 py-3 text-base font-semibold text-white shadow-sm transition-colors hover:bg-amber-600 disabled:opacity-50"
          >
            {acting ? "Processing..." : "Skip"}
          </button>
        </div>
      </div>
    </div>
  );
}
