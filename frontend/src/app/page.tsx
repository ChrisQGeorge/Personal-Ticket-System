"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { QueueStats, GameStats } from "@/lib/types";
import { getQueueStats, getGameStats } from "@/lib/api";
import { useProfile } from "@/lib/profile-context";

export default function HomePage() {
  const { profiles, activeProfile, setActiveProfileId } = useProfile();
  const [stats, setStats] = useState<QueueStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [gameStats, setGameStats] = useState<GameStats | null>(null);

  const loadStats = useCallback(() => {
    setLoading(true);
    setError("");
    getQueueStats(activeProfile?.id)
      .then(setStats)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [activeProfile?.id]);

  useEffect(() => {
    loadStats();
    getGameStats().then(setGameStats).catch(() => {});
  }, [loadStats]);

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

      {/* Profile Switcher */}
      {profiles.length > 0 && (
        <div className="mx-auto max-w-lg">
          <div className="flex flex-wrap items-center justify-center gap-2">
            {profiles.map((p) => {
              const isActive = activeProfile?.id === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setActiveProfileId(p.id)}
                  className="min-h-[44px] rounded-full px-4 py-2 text-sm font-medium transition-colors"
                  style={
                    isActive
                      ? { backgroundColor: p.color, color: "#fff" }
                      : {
                          backgroundColor: "transparent",
                          color: p.color,
                          border: `2px solid ${p.color}`,
                        }
                  }
                >
                  {p.name}
                </button>
              );
            })}
            <Link
              href="/profiles/new"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border-2 border-dashed border-gray-300 text-gray-400 transition-colors hover:border-gray-400 hover:text-gray-500"
              title="Create profile"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </Link>
            <Link
              href="/profiles"
              className="min-h-[44px] rounded-full px-3 py-2 text-sm text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700"
              title="Manage profiles"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </Link>
          </div>
        </div>
      )}

      {/* Gamification summary */}
      {gameStats?.gamification_enabled && (
        <Link href="/gamification" className="mx-auto block max-w-lg">
          <div className="rounded-xl border border-purple-200 bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50 p-4 shadow-sm transition-all hover:shadow-md">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 text-sm font-black text-white">
                  {gameStats.current_level}
                </div>
                <div>
                  <div className="text-sm font-bold text-gray-900">
                    {gameStats.rank_title}
                  </div>
                  <div className="text-xs text-gray-500">
                    {gameStats.total_xp.toLocaleString()} XP
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 text-sm">
                {gameStats.current_streak > 0 && (
                  <span className="flex items-center gap-1 text-orange-600">
                    {gameStats.current_streak >= 3 ? "\uD83D\uDD25" : ""} {gameStats.current_streak}
                  </span>
                )}
                {gameStats.combo_count > 0 && (
                  <span className="flex items-center gap-1 text-blue-600">
                    {"\u26A1"} {gameStats.combo_count}x
                  </span>
                )}
              </div>
            </div>
            {/* Mini XP bar */}
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-purple-200/50">
              <div
                className="h-full rounded-full bg-gradient-to-r from-purple-500 to-amber-400 transition-all duration-700"
                style={{
                  width: `${
                    gameStats.xp_for_next_level > gameStats.xp_for_current_level
                      ? ((gameStats.total_xp - gameStats.xp_for_current_level) /
                          (gameStats.xp_for_next_level - gameStats.xp_for_current_level)) *
                        100
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>
        </Link>
      )}

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
