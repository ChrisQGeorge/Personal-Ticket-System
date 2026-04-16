"use client";

import { useRef, useState } from "react";
import { downloadBackup, restoreBackup } from "@/lib/api";
import { useProfile } from "@/lib/profile-context";
import { useAuth } from "@/lib/auth-context";

interface RestoreResult {
  restored: boolean;
  profiles: number;
  tickets: number;
  recurring_templates: number;
  ticket_relationships: number;
}

export default function BackupPage() {
  const { user, isAdmin } = useAuth();
  const { refreshProfiles } = useProfile();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<RestoreResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError("");
    setResult(null);
    setFile(e.target.files?.[0] ?? null);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setError("");
    setResult(null);
    const dropped = e.dataTransfer.files?.[0];
    if (dropped) {
      setFile(dropped);
      if (inputRef.current) {
        const dt = new DataTransfer();
        dt.items.add(dropped);
        inputRef.current.files = dt.files;
      }
    }
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
  }

  async function handleDownload() {
    setError("");
    setDownloading(true);
    try {
      await downloadBackup();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Backup download failed.");
    } finally {
      setDownloading(false);
    }
  }

  async function handleRestore(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    if (!confirm("Are you sure? This will replace all existing data.")) return;
    setError("");
    setResult(null);
    setLoading(true);

    try {
      const data = await restoreBackup(file);
      setResult(data);
      await refreshProfiles();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Restore failed.");
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setFile(null);
    setResult(null);
    setError("");
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  return (
    <div className="mx-auto max-w-2xl py-8">
      {/* Backup Section */}
      <h1 className="mb-2 text-2xl font-bold text-gray-900">
        Backup {user ? `\u2014 ${user.username}'s Data` : ""}
      </h1>
      <p className="mb-4 text-sm text-gray-500">
        Download a complete backup of your data including profiles, tickets,
        recurring templates, and settings.
      </p>

      {isAdmin && (
        <div className="mb-6 rounded-md bg-indigo-50 p-3 text-sm text-indigo-700">
          As an admin, your backup includes all system data across all users.
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="mb-10">
        <button
          onClick={handleDownload}
          disabled={downloading}
          className="inline-flex min-h-[44px] items-center rounded-md bg-indigo-600 px-6 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
        >
          {downloading ? "Downloading..." : "Download Backup"}
        </button>
      </div>

      {/* Restore Section */}
      <h2 className="mb-2 text-2xl font-bold text-gray-900">Restore</h2>

      <div className="mb-6 rounded-md bg-amber-50 p-3 text-sm text-amber-700">
        Restoring from a backup will replace ALL existing data. This action
        cannot be undone.
      </div>

      {!result && (
        <form onSubmit={handleRestore} className="space-y-4">
          {/* Drop Zone */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => inputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 px-6 py-10 text-center transition-colors hover:border-indigo-400 hover:bg-gray-100"
          >
            <p className="text-sm text-gray-600">
              {file ? file.name : "Choose a file or drag it here"}
            </p>
            <p className="mt-1 text-xs text-gray-400">
              Accepted format: .json
            </p>
            <input
              ref={inputRef}
              type="file"
              accept=".json"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          <button
            type="submit"
            disabled={!file || loading}
            className="min-h-[44px] rounded-md bg-red-600 px-6 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? "Restoring..." : "Restore"}
          </button>
        </form>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">
            Restored {result.profiles} profile(s), {result.tickets} ticket(s),{" "}
            {result.recurring_templates} template(s), {result.ticket_relationships}{" "}
            relationship(s).
          </div>

          <button
            type="button"
            onClick={handleReset}
            className="min-h-[44px] rounded-md bg-indigo-600 px-6 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
          >
            Restore Another
          </button>
        </div>
      )}
    </div>
  );
}
