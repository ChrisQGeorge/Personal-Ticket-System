"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { Ticket, GameStats, GameEvent, SkipGameEvent } from "@/lib/types";
import { getNextTicket, completeTicket, skipTicket, getGameStats } from "@/lib/api";
import { useProfile } from "@/lib/profile-context";
import GameEventToast from "@/components/GameEventToast";

export default function QueuePage() {
  const { activeProfile } = useProfile();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState("");
  const [empty, setEmpty] = useState(false);

  // Gamification state
  const [gameStats, setGameStats] = useState<GameStats | null>(null);
  const [gameEvent, setGameEvent] = useState<GameEvent | SkipGameEvent | null>(null);

  const loadNext = useCallback(async () => {
    setLoading(true);
    setError("");
    setEmpty(false);
    try {
      const t = await getNextTicket(activeProfile?.id);
      if (t) {
        setTicket(t);
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
      .catch(() => {
        /* gamification may not be available */
      });
  }, []);

  useEffect(() => {
    loadNext();
    loadGameStats();
  }, [loadNext, loadGameStats]);

  async function handleComplete() {
    if (!ticket) return;
    setActing(true);
    setError("");
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result: any = await completeTicket(ticket.id);
      if (result?.game_event) {
        setGameEvent(result.game_event as GameEvent);
        loadGameStats();
      }
      const next = await getNextTicket(activeProfile?.id);
      if (next) {
        setTicket(next);
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result: any = await skipTicket(ticket.id);
      if (result?.game_event) {
        setGameEvent(result.game_event as SkipGameEvent);
        loadGameStats();
      }
      const next = await getNextTicket(activeProfile?.id);
      if (next) {
        setTicket(next);
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

  const gamificationEnabled = gameStats?.gamification_enabled;

  if (loading) {
    return <p className="text-sm text-gray-400">Loading queue...</p>;
  }

  if (error) {
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
          <p className="mt-1 text-sm text-gray-400">
            Create one to get started.
          </p>
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

      {/* Game event toast */}
      <GameEventToast event={gameEvent} onDismiss={() => setGameEvent(null)} />

      {/* Gamification status bar */}
      {gamificationEnabled && gameStats && (
        <div className="mx-auto flex max-w-2xl items-center justify-center gap-4 rounded-lg border border-purple-200 bg-gradient-to-r from-purple-50 to-indigo-50 px-4 py-2 text-sm">
          <span className="font-semibold text-purple-700">
            Lv.{gameStats.current_level}
          </span>
          <span className="text-gray-400">|</span>
          {gameStats.current_streak > 0 && (
            <>
              <span className="flex items-center gap-1 text-orange-600">
                {gameStats.current_streak >= 3 ? "\uD83D\uDD25" : ""}{" "}
                {gameStats.current_streak} streak
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
          <span className="text-amber-600 font-medium">
            {gameStats.total_xp.toLocaleString()} XP
          </span>
        </div>
      )}

      <div className="mx-auto max-w-2xl rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        {/* Header */}
        <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <h2 className="text-xl font-semibold text-gray-900">
            <span className="mr-1 text-gray-400">#{ticket.id}</span>
            {ticket.title}
          </h2>
          <Link
            href={`/tickets/${ticket.id}`}
            className="text-xs text-indigo-600 hover:underline"
          >
            Edit
          </Link>
        </div>

        {/* Details grid */}
        <div className="mb-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
          <div>
            <span className="font-medium text-gray-500">Priority</span>
            <div className={priorityColors[ticket.priority] ?? ""}>
              {ticket.priority}
            </div>
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
          {ticket.est_hours != null && (
            <div>
              <span className="font-medium text-gray-500">Est. Hours</span>
              <div>{ticket.est_hours}</div>
            </div>
          )}
          <div>
            <span className="font-medium text-gray-500">Created</span>
            <div>{new Date(ticket.date_created).toLocaleDateString()}</div>
          </div>
        </div>

        {/* Description */}
        {ticket.description && (
          <div className="mb-4 rounded-md bg-gray-50 p-4">
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-500">
              Description
            </h3>
            <div className="whitespace-pre-wrap text-sm text-gray-700">
              {ticket.description}
            </div>
          </div>
        )}

        {/* Custom Attributes */}
        {ticket.custom_attributes && ticket.custom_attributes.length > 0 && (
          <div className="mb-6 rounded-md bg-gray-50 p-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
              Attributes
            </h3>
            <div className="space-y-2">
              {ticket.custom_attributes.map((a, i) => {
                const isNumber = a.type === "number";
                const current = a.current;
                const goal = a.goal;
                let progress = 0;
                if (isNumber && typeof current === "number" && typeof goal === "number" && goal > 0) {
                  progress = Math.min(100, (current / goal) * 100);
                }
                return (
                  <div key={i} className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium text-gray-700">{a.name}</span>
                    <div className="flex items-center gap-2">
                      {isNumber ? (
                        <>
                          <span className="text-gray-600 tabular-nums">
                            {String(current ?? 0)} / {String(goal ?? 0)}
                          </span>
                          <div className="h-2 w-24 overflow-hidden rounded-full bg-gray-200">
                            <div
                              className="h-full bg-indigo-500 transition-all"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </>
                      ) : a.type === "boolean" ? (
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${current ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"}`}>
                          {current ? "Yes" : "No"}
                        </span>
                      ) : (
                        <span className="text-gray-600">
                          {current != null && current !== "" ? String(current) : <em className="text-gray-400">unset</em>}
                          {goal != null && goal !== "" && current !== goal ? (
                            <span className="text-gray-400"> / goal: {String(goal)}</span>
                          ) : null}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
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
