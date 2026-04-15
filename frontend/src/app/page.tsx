"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { QueueStats } from "@/lib/types";
import { getQueueStats } from "@/lib/api";

export default function HomePage() {
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getQueueStats()
      .then(setStats)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 sm:text-4xl">
          Personal Ticket System
        </h1>
        <p className="mt-2 text-gray-500">
          Manage your tasks, work the queue, stay on track.
        </p>
      </div>

      {/* Quick actions */}
      <div className="mx-auto grid max-w-md gap-4 sm:max-w-lg sm:grid-cols-2">
        <Link
          href="/tickets/new"
          className="flex min-h-[80px] items-center justify-center rounded-lg bg-indigo-600 px-6 py-4 text-lg font-semibold text-white shadow-md transition-colors hover:bg-indigo-700"
        >
          Create Ticket
        </Link>
        <Link
          href="/queue"
          className="flex min-h-[80px] items-center justify-center rounded-lg bg-emerald-600 px-6 py-4 text-lg font-semibold text-white shadow-md transition-colors hover:bg-emerald-700"
        >
          Work Queue
        </Link>
      </div>

      {/* Stats */}
      <div className="mx-auto max-w-lg">
        <h2 className="mb-3 text-center text-lg font-semibold text-gray-700">
          Queue Stats
        </h2>

        {loading && (
          <p className="text-center text-sm text-gray-400">Loading stats...</p>
        )}

        {error && (
          <p className="text-center text-sm text-red-500">
            Could not load stats: {error}
          </p>
        )}

        {stats && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="Total" value={stats.total} color="bg-gray-100 text-gray-800" />
            <StatCard label="Open" value={stats.total_open} color="bg-blue-50 text-blue-700" />
            <StatCard
              label="In Progress"
              value={stats.total_in_progress}
              color="bg-yellow-50 text-yellow-700"
            />
            <StatCard
              label="Completed"
              value={stats.total_completed}
              color="bg-green-50 text-green-700"
            />
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className={`rounded-lg p-4 text-center ${color}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs font-medium uppercase tracking-wide">{label}</div>
    </div>
  );
}
