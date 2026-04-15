"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Profile, ProfileUpdate } from "@/lib/types";
import { getProfile, updateProfile, deleteProfile, testProfileEmail } from "@/lib/api";
import { useProfile } from "@/lib/profile-context";

export default function EditProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { refreshProfiles } = useProfile();
  const id = Number(params.id);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // General fields
  const [name, setName] = useState("");
  const [color, setColor] = useState("#6366f1");

  // Email fields
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [imapHost, setImapHost] = useState("");
  const [imapPort, setImapPort] = useState("993");
  const [imapUser, setImapUser] = useState("");
  const [imapPassword, setImapPassword] = useState("");
  const [imapUseSsl, setImapUseSsl] = useState(true);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (isNaN(id)) {
      setError("Invalid profile ID");
      setLoading(false);
      return;
    }
    getProfile(id)
      .then((p) => {
        setProfile(p);
        setName(p.name);
        setColor(p.color);
        setEmailEnabled(p.email_enabled);
        setImapHost(p.imap_host ?? "");
        setImapPort(String(p.imap_port ?? 993));
        setImapUser(p.imap_user ?? "");
        setImapUseSsl(p.imap_use_ssl);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load profile"))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setError("");
    setSuccess("");
    setSaving(true);

    try {
      const data: ProfileUpdate = {
        name: name.trim(),
        color,
        email_enabled: emailEnabled,
        imap_host: imapHost.trim() || undefined,
        imap_port: imapPort ? parseInt(imapPort) : undefined,
        imap_user: imapUser.trim() || undefined,
        imap_use_ssl: imapUseSsl,
      };
      // Only send password if user typed a new one
      if (imapPassword) {
        data.imap_password = imapPassword;
      }
      const updated = await updateProfile(id, data);
      setProfile(updated);
      setImapPassword("");
      await refreshProfiles();
      setSuccess("Profile saved successfully.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save profile.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this profile?")) return;
    setDeleting(true);
    setError("");
    try {
      await deleteProfile(id);
      await refreshProfiles();
      router.push("/profiles");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete profile. It may have tickets assigned.");
      setDeleting(false);
    }
  }

  async function handleTestEmail() {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await testProfileEmail(id);
      setTestResult(result);
    } catch (err: unknown) {
      setTestResult({
        success: false,
        message: err instanceof Error ? err.message : "Test failed.",
      });
    } finally {
      setTesting(false);
    }
  }

  if (loading) {
    return <p className="text-sm text-gray-400">Loading profile...</p>;
  }

  if (error && !profile) {
    return <p className="text-sm text-red-500">{error}</p>;
  }

  if (!profile) {
    return <p className="text-sm text-gray-500">Profile not found.</p>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="text-2xl font-bold text-gray-900">Edit Profile</h1>

      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">
          {success}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-8">
        {/* General Section */}
        <fieldset className="space-y-4">
          <legend className="text-base font-semibold text-gray-900">General</legend>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Color
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-10 w-14 cursor-pointer rounded border border-gray-300"
              />
              <input
                type="text"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-28 rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
        </fieldset>

        {/* Email Configuration Section */}
        <fieldset className="space-y-4">
          <legend className="text-base font-semibold text-gray-900">
            Email Configuration
          </legend>

          <div className="flex items-center pb-1">
            <label className="flex min-h-[44px] items-center gap-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={emailEnabled}
                onChange={(e) => setEmailEnabled(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              Email Enabled
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                IMAP Host
              </label>
              <input
                type="text"
                value={imapHost}
                onChange={(e) => setImapHost(e.target.value)}
                placeholder="imap.gmail.com"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                IMAP Port
              </label>
              <input
                type="number"
                value={imapPort}
                onChange={(e) => setImapPort(e.target.value)}
                placeholder="993"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                IMAP Username
              </label>
              <input
                type="text"
                value={imapUser}
                onChange={(e) => setImapUser(e.target.value)}
                placeholder="my.pts@gmail.com"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                IMAP Password
              </label>
              <input
                type="password"
                value={imapPassword}
                onChange={(e) => setImapPassword(e.target.value)}
                placeholder={profile.has_password ? "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" : "Enter password"}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              {profile.has_password && (
                <p className="mt-1 text-xs text-gray-400">
                  Leave blank to keep existing password.
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center pb-1">
            <label className="flex min-h-[44px] items-center gap-2 text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={imapUseSsl}
                onChange={(e) => setImapUseSsl(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              Use SSL
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleTestEmail}
              disabled={testing}
              className="min-h-[44px] rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
            >
              {testing ? "Testing..." : "Test Connection"}
            </button>

            {testResult && (
              <span
                className={`text-sm font-medium ${
                  testResult.success ? "text-green-600" : "text-red-600"
                }`}
              >
                {testResult.message}
              </span>
            )}
          </div>

          <p className="text-xs text-gray-400">
            For Gmail, use an App Password. Go to myaccount.google.com &rarr; Security &rarr; App Passwords.
          </p>
        </fieldset>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="min-h-[44px] rounded-md bg-indigo-600 px-6 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Profile"}
          </button>

          <button
            type="button"
            onClick={() => router.push("/profiles")}
            className="min-h-[44px] rounded-md border border-gray-300 bg-white px-6 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="min-h-[44px] rounded-md bg-red-600 px-6 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 disabled:opacity-50 sm:ml-auto"
          >
            {deleting ? "Deleting..." : "Delete Profile"}
          </button>
        </div>
      </form>
    </div>
  );
}
