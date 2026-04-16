"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { changePassword, getGameStats, toggleGamification } from "@/lib/api";

export default function AccountPage() {
  const { user, isAdmin } = useAuth();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [gamificationEnabled, setGamificationEnabled] = useState(false);
  const [gamificationLoading, setGamificationLoading] = useState(true);
  const [gamificationToggling, setGamificationToggling] = useState(false);

  useEffect(() => {
    getGameStats()
      .then((s) => setGamificationEnabled(s.gamification_enabled))
      .catch(() => {})
      .finally(() => setGamificationLoading(false));
  }, []);

  async function handleToggleGamification() {
    setGamificationToggling(true);
    try {
      const res = await toggleGamification(!gamificationEnabled);
      setGamificationEnabled(res.gamification_enabled);
    } catch {
      // ignore
    } finally {
      setGamificationToggling(false);
    }
  }

  if (!user) return null;

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (!/[A-Z]/.test(newPassword)) {
      setError("New password must contain at least one uppercase letter.");
      return;
    }
    if (!/[a-z]/.test(newPassword)) {
      setError("New password must contain at least one lowercase letter.");
      return;
    }
    if (!/\d/.test(newPassword)) {
      setError("New password must contain at least one digit.");
      return;
    }
    if (!/[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/~`]/.test(newPassword)) {
      setError("New password must contain at least one special character.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    setSaving(true);
    try {
      await changePassword(currentPassword, newPassword);
      setSuccess("Password changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to change password."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg py-8 space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Account</h1>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <dl className="space-y-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">Username</dt>
            <dd className="mt-1 text-sm text-gray-900">{user.username}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Role</dt>
            <dd className="mt-1">
              <span
                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  isAdmin
                    ? "bg-amber-100 text-amber-800"
                    : "bg-gray-100 text-gray-800"
                }`}
              >
                {user.role}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Status</dt>
            <dd className="mt-1">
              <span
                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  user.is_active
                    ? "bg-green-100 text-green-800"
                    : "bg-red-100 text-red-800"
                }`}
              >
                {user.is_active ? "Active" : "Inactive"}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">
              Account Created
            </dt>
            <dd className="mt-1 text-sm text-gray-900">
              {new Date(user.created_at).toLocaleDateString(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </dd>
          </div>
        </dl>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Change Password
        </h2>

        {error && (
          <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-4 rounded-md bg-green-50 p-3 text-sm text-green-700">
            {success}
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Current Password
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              New Password
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={8}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <p className="mt-1 text-xs text-gray-400">
              Min 8 characters. Must include uppercase, lowercase, digit, and special character.
            </p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Confirm New Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="min-h-[44px] rounded-md bg-indigo-600 px-6 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? "Changing..." : "Change Password"}
          </button>
        </form>
      </div>

      {/* Gamification toggle */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Gamification
        </h2>
        {gamificationLoading ? (
          <p className="text-sm text-gray-400">Loading...</p>
        ) : (
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="font-medium text-gray-900">
                Enable Task Quest (Gamification)
              </div>
              <p className="mt-1 text-sm text-gray-500">
                Earn XP for completing tickets, build streaks, unlock achievements, and take on daily challenges.
                Skipping tickets costs XP.
              </p>
            </div>
            <button
              onClick={handleToggleGamification}
              disabled={gamificationToggling}
              className={`relative inline-flex h-7 w-12 min-w-[48px] flex-shrink-0 items-center rounded-full transition-colors ${
                gamificationEnabled ? "bg-purple-600" : "bg-gray-300"
              }`}
              role="switch"
              aria-checked={gamificationEnabled}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                  gamificationEnabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
