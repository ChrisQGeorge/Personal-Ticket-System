"use client";

import { useRef, useState } from "react";
import { importTickets, getTemplateUrl } from "@/lib/api";
import { useProfile } from "@/lib/profile-context";

interface ImportResult {
  imported: number;
  errors: { row: number; error: string }[];
}

export default function ImportPage() {
  const { activeProfile } = useProfile();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
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

  async function handleImport(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setError("");
    setResult(null);
    setLoading(true);

    try {
      const data = await importTickets(file, activeProfile?.id);
      setResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Import failed.");
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
      <h1 className="mb-2 text-2xl font-bold text-gray-900">Import Tickets</h1>
      <p className="mb-6 text-sm text-gray-500">
        Upload a CSV or Excel (.xlsx) file to bulk-import tickets. Download the
        template below to see the expected format.
      </p>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Template Download */}
      <div className="mb-6">
        <a
          href={getTemplateUrl()}
          download
          className="inline-flex min-h-[44px] items-center rounded-md border border-gray-300 bg-white px-6 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
        >
          Download Template
        </a>
      </div>

      {/* Import Form */}
      {!result && (
        <form onSubmit={handleImport} className="space-y-4">
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
              Accepted formats: .csv, .xlsx, .xls
            </p>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>

          <button
            type="submit"
            disabled={!file || loading}
            className="min-h-[44px] rounded-md bg-indigo-600 px-6 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? "Importing..." : "Import"}
          </button>
        </form>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-4">
          <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">
            Successfully imported {result.imported} ticket(s).
          </div>

          {result.errors.length > 0 && (
            <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-700">
              <p className="font-medium">
                {result.errors.length} row(s) had errors:
              </p>
              <ul className="mt-2 list-inside list-disc space-y-1">
                {result.errors.map((err, i) => (
                  <li key={i}>
                    Row {err.row}: {err.error}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button
            type="button"
            onClick={handleReset}
            className="min-h-[44px] rounded-md bg-indigo-600 px-6 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
          >
            Import Another
          </button>
        </div>
      )}
    </div>
  );
}
