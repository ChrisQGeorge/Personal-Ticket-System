"use client";

import { useEffect, useState } from "react";
import { GameEvent, SkipGameEvent } from "@/lib/types";

interface GameEventToastProps {
  event: GameEvent | SkipGameEvent | null;
  onDismiss: () => void;
}

function isCompleteEvent(e: GameEvent | SkipGameEvent): e is GameEvent {
  return "xp_earned" in e;
}

export default function GameEventToast({ event, onDismiss }: GameEventToastProps) {
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (!event) return;
    setExiting(false);
    const isComplete = isCompleteEvent(event);
    const duration = isComplete ? 4000 : 3000;
    const timer = setTimeout(() => {
      setExiting(true);
      setTimeout(onDismiss, 300);
    }, duration);
    return () => clearTimeout(timer);
  }, [event, onDismiss]);

  if (!event) return null;

  const complete = isCompleteEvent(event);

  return (
    <div className="fixed right-4 top-20 z-50 w-80 max-w-[calc(100vw-2rem)]">
      <div
        className={`rounded-xl border shadow-2xl backdrop-blur-sm ${exiting ? "animate-toast-out" : "animate-toast-in"} ${
          complete
            ? "border-amber-400/50 bg-gradient-to-br from-amber-50 to-yellow-50"
            : "border-red-400/50 bg-gradient-to-br from-red-50 to-orange-50"
        }`}
      >
        <div className="p-4">
          {/* XP display */}
          <div className="mb-2 flex items-center justify-between">
            <span
              className={`text-2xl font-extrabold ${
                complete ? "text-amber-600" : "text-red-600"
              }`}
            >
              {complete ? `+${(event as GameEvent).xp_earned} XP` : `${(event as SkipGameEvent).xp_lost} XP`}
            </span>
            <button
              onClick={() => {
                setExiting(true);
                setTimeout(onDismiss, 300);
              }}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {complete && (() => {
            const ce = event as GameEvent;
            return (
              <>
                {/* XP Breakdown */}
                <div className="mb-2 flex flex-wrap gap-1.5 text-xs text-amber-700">
                  {ce.xp_breakdown.base != null && (
                    <span className="rounded bg-amber-100 px-1.5 py-0.5">
                      Base: {ce.xp_breakdown.base}
                    </span>
                  )}
                  {ce.xp_breakdown.streak_multiplier != null && ce.xp_breakdown.streak_multiplier !== 1 && (
                    <span className="rounded bg-orange-100 px-1.5 py-0.5">
                      Streak: {ce.xp_breakdown.streak_multiplier}x
                    </span>
                  )}
                  {ce.xp_breakdown.combo_multiplier != null && ce.xp_breakdown.combo_multiplier !== 1 && (
                    <span className="rounded bg-blue-100 px-1.5 py-0.5 text-blue-700">
                      Combo: {ce.xp_breakdown.combo_multiplier}x
                    </span>
                  )}
                  {ce.xp_breakdown.early_bonus != null && ce.xp_breakdown.early_bonus > 0 && (
                    <span className="rounded bg-green-100 px-1.5 py-0.5 text-green-700">
                      Early: +{ce.xp_breakdown.early_bonus}
                    </span>
                  )}
                </div>

                {/* Level info */}
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="font-medium">Lv.{ce.level}</span>
                  <span className="text-gray-400">{ce.rank_title}</span>
                  {(ce.streak ?? 0) > 0 && (
                    <span className="text-orange-500">{(ce.streak ?? 0) >= 3 ? "\uD83D\uDD25" : ""} {ce.streak} streak</span>
                  )}
                  {(ce.combo ?? 0) > 1 && (
                    <span className="text-blue-500">\u26A1 {ce.combo}x combo</span>
                  )}
                </div>

                {/* Level up */}
                {ce.leveled_up && (
                  <div className="mt-2 animate-level-up rounded-lg bg-gradient-to-r from-purple-500 to-indigo-500 px-3 py-2 text-center text-sm font-bold text-white shadow-lg">
                    LEVEL UP! Level {ce.new_level} &mdash; {ce.rank_title}
                  </div>
                )}

                {/* New achievements */}
                {(ce.new_achievements ?? []).length > 0 && (
                  <div className="mt-2 space-y-1">
                    {(ce.new_achievements ?? []).map((a) => (
                      <div
                        key={a.id}
                        className="flex items-center gap-2 rounded-lg bg-green-100 px-3 py-1.5 text-sm font-medium text-green-800"
                      >
                        <span>\uD83C\uDFC6</span>
                        <span>Achievement: {a.name}</span>
                        <span className="ml-auto text-xs text-green-600">+{a.xp} XP</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Challenge progress */}
                {(ce.challenge_progress ?? []).filter((c) => c.completed).length > 0 && (
                  <div className="mt-2 space-y-1">
                    {(ce.challenge_progress ?? []).filter((c) => c.completed).map((c) => (
                      <div
                        key={c.name}
                        className="flex items-center gap-2 rounded-lg bg-blue-100 px-3 py-1.5 text-sm font-medium text-blue-800"
                      >
                        <span>\u2705</span>
                        <span>Challenge Complete: {c.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            );
          })()}

          {!complete && (() => {
            const se = event as SkipGameEvent;
            return (
              <div className="space-y-1 text-sm text-red-600">
                {se.combo_reset && (
                  <div className="font-medium">Combo Reset!</div>
                )}
                <div className="text-xs text-gray-500">
                  Weekly skips: {se.weekly_skips}
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}
