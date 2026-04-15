"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { Ticket } from "@/lib/types";
import { getNextTicket, completeTicket, skipTicket } from "@/lib/api";
import { useProfile } from "@/lib/profile-context";

export default function QueuePage() {
  const { activeProfile } = useProfile();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState("");
  const [empty, setEmpty] = useState(false);

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

  useEffect(() => {
    loadNext();
  }, [loadNext]);

  async function handleComplete() {
    if (!ticket) return;
    setActing(true);
    setError("");
    try {
      await completeTicket(ticket.id);
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
      await skipTicket(ticket.id);
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
          <div className="mb-6 rounded-md bg-gray-50 p-4">
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-500">
              Description
            </h3>
            <div className="whitespace-pre-wrap text-sm text-gray-700">
              {ticket.description}
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
