"use client";

import { useEffect, useState, useCallback } from "react";
import { GameStats } from "@/lib/types";
import { getGameStats, toggleGamification } from "@/lib/api";

export default function GamificationPage() {
  const [stats, setStats] = useState<GameStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toggling, setToggling] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    getGameStats()
      .then(setStats)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleToggle() {
    if (!stats) return;
    setToggling(true);
    try {
      const res = await toggleGamification(!stats.gamification_enabled);
      setStats((prev) =>
        prev ? { ...prev, gamification_enabled: res.gamification_enabled } : prev
      );
      if (res.gamification_enabled) load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Toggle failed");
    } finally {
      setToggling(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-gray-400">Loading gamification stats...</p>;
  }

  if (error) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-bold text-gray-900">Task Quest</h1>
        <p className="text-sm text-red-500">{error}</p>
        <button
          onClick={load}
          className="min-h-[44px] rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!stats) return null;

  // If gamification is off, show the enable prompt
  if (!stats.gamification_enabled) {
    return (
      <div className="mx-auto max-w-lg space-y-6 py-12 text-center">
        <div className="text-6xl">{"\uD83C\uDFAE"}</div>
        <h1 className="text-3xl font-bold text-gray-900">Task Quest</h1>
        <p className="text-gray-500">
          Turn your task management into an adventure! Earn XP for completing tickets,
          build streaks, unlock achievements, and take on daily challenges.
        </p>
        <div className="mx-auto max-w-sm space-y-3 text-left text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <span className="text-amber-500">{"\u2B50"}</span> Earn XP and level up through ranks
          </div>
          <div className="flex items-center gap-2">
            <span className="text-orange-500">{"\uD83D\uDD25"}</span> Build streaks for bonus multipliers
          </div>
          <div className="flex items-center gap-2">
            <span className="text-blue-500">{"\u26A1"}</span> Chain combos for extra rewards
          </div>
          <div className="flex items-center gap-2">
            <span className="text-green-500">{"\uD83C\uDFC6"}</span> Unlock achievements and take on challenges
          </div>
        </div>
        <button
          onClick={handleToggle}
          disabled={toggling}
          className="min-h-[52px] rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 px-8 py-3 text-lg font-bold text-white shadow-lg transition-all hover:from-purple-700 hover:to-indigo-700 hover:shadow-xl disabled:opacity-50"
        >
          {toggling ? "Enabling..." : "Enable Task Quest"}
        </button>
      </div>
    );
  }

  const xpPercent =
    stats.xp_for_next_level > stats.xp_for_current_level
      ? ((stats.total_xp - stats.xp_for_current_level) /
          (stats.xp_for_next_level - stats.xp_for_current_level)) *
        100
      : 0;

  const unlockedCount = stats.achievements.filter((a) => a.unlocked).length;
  const totalAchievements = stats.achievements.length;

  const rateColor =
    stats.completion_rate > 80
      ? "text-green-600"
      : stats.completion_rate > 50
        ? "text-yellow-600"
        : "text-red-600";

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 p-6 text-white shadow-xl sm:p-8">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <div>
            <div className="text-sm font-medium uppercase tracking-wider text-purple-200">
              Task Quest
            </div>
            <h1 className="text-3xl font-extrabold sm:text-4xl">
              Level {stats.current_level}{" "}
              <span className="text-purple-200">&mdash;</span>{" "}
              <span className="text-amber-300">{stats.rank_title}</span>
            </h1>
            <div className="mt-1 text-sm text-purple-200">
              {stats.total_xp.toLocaleString()} total XP
            </div>
          </div>
          <div className="text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/10 text-3xl font-black text-amber-300 shadow-inner">
              {stats.current_level}
            </div>
          </div>
        </div>

        {/* XP Progress bar */}
        <div className="mt-6">
          <div className="mb-1 flex justify-between text-xs text-purple-200">
            <span>{stats.xp_for_current_level.toLocaleString()} XP</span>
            <span>{stats.xp_for_next_level.toLocaleString()} XP</span>
          </div>
          <div className="h-4 overflow-hidden rounded-full bg-white/20">
            <div
              className="animate-xp-fill h-full rounded-full bg-gradient-to-r from-amber-400 to-yellow-300"
              style={{ width: `${Math.min(xpPercent, 100)}%` }}
            />
          </div>
          <div className="mt-1 text-center text-xs text-purple-200">
            {(stats.xp_for_next_level - stats.total_xp).toLocaleString()} XP to next level
          </div>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-orange-200 bg-gradient-to-br from-orange-50 to-amber-50 p-4 shadow-sm">
          <div className="mb-1 text-xs font-medium uppercase tracking-wider text-orange-500">
            Streak
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-orange-600">
              {stats.current_streak}
            </span>
            {stats.current_streak >= 3 && <span className="text-xl">{"\uD83D\uDD25"}</span>}
            {stats.streak_shield_available && (
              <span className="text-lg" title="Streak shield available">{"\uD83D\uDEE1\uFE0F"}</span>
            )}
          </div>
          <div className="text-xs text-orange-400">days</div>
        </div>

        <div className="rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-4 shadow-sm">
          <div className="mb-1 text-xs font-medium uppercase tracking-wider text-blue-500">
            Combo
          </div>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold text-blue-600">
              {stats.combo_count}x
            </span>
            {stats.combo_count >= 2 && <span className="text-xl">{"\u26A1"}</span>}
          </div>
          <div className="text-xs text-blue-400">chain</div>
        </div>

        <div className="rounded-xl border border-green-200 bg-gradient-to-br from-green-50 to-emerald-50 p-4 shadow-sm">
          <div className="mb-1 text-xs font-medium uppercase tracking-wider text-green-500">
            Completion
          </div>
          <div className={`text-2xl font-bold ${rateColor}`}>
            {stats.completion_rate.toFixed(1)}%
          </div>
          <div className="text-xs text-green-400">rate</div>
        </div>

        <div className="rounded-xl border border-purple-200 bg-gradient-to-br from-purple-50 to-fuchsia-50 p-4 shadow-sm">
          <div className="mb-1 text-xs font-medium uppercase tracking-wider text-purple-500">
            Today
          </div>
          <div className="text-2xl font-bold text-purple-600">
            {stats.tickets_completed_today}
          </div>
          <div className="text-xs text-purple-400">completed</div>
        </div>
      </div>

      {/* Daily Challenges */}
      {stats.daily_challenges.length > 0 && (
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-gray-900">
            <span>{"\uD83C\uDFAF"}</span> Daily Challenges
            <span className="text-xs font-normal text-gray-400">Resets daily</span>
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {stats.daily_challenges.map((c) => {
              const pct = c.target > 0 ? (c.progress / c.target) * 100 : 0;
              return (
                <div
                  key={c.id}
                  className={`rounded-xl border p-4 shadow-sm transition-all ${
                    c.completed
                      ? "border-green-300 bg-green-50"
                      : "border-gray-200 bg-white hover:shadow-md"
                  }`}
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-semibold text-gray-900">
                      {c.completed && <span className="mr-1">{"\u2705"}</span>}
                      {c.name}
                    </span>
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">
                      +{c.xp} XP
                    </span>
                  </div>
                  <p className="mb-2 text-xs text-gray-500">{c.description}</p>
                  <div className="h-2 overflow-hidden rounded-full bg-gray-200">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-blue-500 transition-all duration-700"
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                  <div className="mt-1 text-xs text-gray-400">
                    {c.progress} / {c.target}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Weekly Challenge */}
      {stats.weekly_challenge && (
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-gray-900">
            <span>{"\uD83D\uDCC5"}</span> Weekly Challenge
          </h2>
          {(() => {
            const wc = stats.weekly_challenge;
            const pct = wc.target > 0 ? (wc.progress / wc.target) * 100 : 0;
            return (
              <div
                className={`rounded-xl border p-5 shadow-sm ${
                  wc.completed
                    ? "border-green-300 bg-gradient-to-r from-green-50 to-emerald-50"
                    : "border-purple-200 bg-gradient-to-r from-purple-50 to-indigo-50"
                }`}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-lg font-bold text-gray-900">
                    {wc.completed && <span className="mr-1">{"\u2705"}</span>}
                    {wc.name}
                  </span>
                  <span className="rounded-full bg-purple-100 px-3 py-1 text-sm font-bold text-purple-700">
                    +{wc.xp} XP
                  </span>
                </div>
                <p className="mb-3 text-sm text-gray-600">{wc.description}</p>
                <div className="h-3 overflow-hidden rounded-full bg-white/60">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-700"
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
                <div className="mt-1 text-sm text-gray-500">
                  {wc.progress} / {wc.target}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Achievements */}
      <div>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-gray-900">
          <span>{"\uD83C\uDFC6"}</span> Achievements
          <span className="text-sm font-normal text-gray-400">
            {unlockedCount} of {totalAchievements} unlocked
          </span>
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {stats.achievements.map((a) => (
            <div
              key={a.id}
              className={`rounded-xl border p-4 transition-all ${
                a.unlocked
                  ? "animate-glow border-amber-300 bg-gradient-to-br from-amber-50 to-yellow-50"
                  : "border-gray-200 bg-gray-50 opacity-60"
              }`}
            >
              <div className="mb-1 flex items-center justify-between">
                <span className="font-semibold text-gray-900">
                  {a.unlocked ? (
                    <span className="mr-1 text-green-500">{"\u2714\uFE0F"}</span>
                  ) : (
                    <span className="mr-1 text-gray-400">{"\uD83D\uDD12"}</span>
                  )}
                  {a.name}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                    a.unlocked
                      ? "bg-amber-100 text-amber-700"
                      : "bg-gray-200 text-gray-500"
                  }`}
                >
                  +{a.xp} XP
                </span>
              </div>
              <p className="text-xs text-gray-500">{a.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Personal Records */}
      <div>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-bold text-gray-900">
          <span>{"\uD83D\uDCCA"}</span> Personal Records
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4 text-center shadow-sm">
            <div className="text-2xl font-bold text-orange-600">{stats.longest_streak}</div>
            <div className="text-xs font-medium uppercase tracking-wider text-gray-500">
              Longest Streak
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 text-center shadow-sm">
            <div className="text-2xl font-bold text-green-600">{stats.total_completed}</div>
            <div className="text-xs font-medium uppercase tracking-wider text-gray-500">
              Completed
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 text-center shadow-sm">
            <div className="text-2xl font-bold text-red-500">{stats.total_skipped}</div>
            <div className="text-xs font-medium uppercase tracking-wider text-gray-500">
              Skipped
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4 text-center shadow-sm">
            <div className="text-2xl font-bold text-blue-600">{stats.combo_count}x</div>
            <div className="text-xs font-medium uppercase tracking-wider text-gray-500">
              Current Combo
            </div>
          </div>
        </div>
      </div>

      {/* Toggle */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-900">Gamification Mode</h3>
            <p className="text-sm text-gray-500">
              Disable to hide XP, levels, streaks, and achievements.
            </p>
          </div>
          <button
            onClick={handleToggle}
            disabled={toggling}
            className={`relative inline-flex h-7 w-12 min-w-[48px] items-center rounded-full transition-colors ${
              stats.gamification_enabled ? "bg-purple-600" : "bg-gray-300"
            }`}
            role="switch"
            aria-checked={stats.gamification_enabled}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                stats.gamification_enabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
