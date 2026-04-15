"use client";

import { useEffect, useState } from "react";
import { QueueConfig } from "@/lib/types";
import { getQueueConfig, updateQueueConfig, resetQueueConfig } from "@/lib/api";

interface FieldDef {
  key: keyof QueueConfig;
  label: string;
  hint: string;
}

const SCORE_WEIGHTS: FieldDef[] = [
  { key: "age_weight", label: "Age Weight", hint: "Points per day since creation" },
  { key: "skip_weight", label: "Skip Weight", hint: "Points per time the ticket has been skipped" },
  { key: "effort_weight", label: "Effort Weight", hint: "Points per estimated hour of effort" },
];

const DUE_DATE_FIELDS: FieldDef[] = [
  { key: "due_date_weight", label: "Due Date Weight", hint: "Points per day until due date" },
  { key: "overdue_penalty", label: "Overdue Penalty", hint: "Flat penalty added when a ticket is past due" },
];

const PRIORITY_FIELDS: FieldDef[] = [
  { key: "priority_very_high", label: "Very High", hint: "Score offset for very-high priority" },
  { key: "priority_high", label: "High", hint: "Score offset for high priority" },
  { key: "priority_default", label: "Default", hint: "Score offset for default priority" },
  { key: "priority_low", label: "Low", hint: "Score offset for low priority" },
  { key: "priority_very_low", label: "Very Low", hint: "Score offset for very-low priority" },
];

export default function ConfigPage() {
  const [config, setConfig] = useState<QueueConfig | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    loadConfig();
  }, []);

  async function loadConfig() {
    setLoading(true);
    setError("");
    try {
      const data = await getQueueConfig();
      setConfig(data);
      setForm(
        Object.fromEntries(
          Object.entries(data).map(([k, v]) => [k, String(v)])
        )
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load config.");
    } finally {
      setLoading(false);
    }
  }

  function handleChange(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSuccess("");
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);

    try {
      const updates: Partial<QueueConfig> = {};
      for (const [key, strVal] of Object.entries(form)) {
        const num = parseFloat(strVal);
        if (isNaN(num)) {
          setError(`Invalid number for ${key}.`);
          setSaving(false);
          return;
        }
        if (config && num !== config[key as keyof QueueConfig]) {
          (updates as Record<string, number>)[key] = num;
        }
      }

      if (Object.keys(updates).length === 0) {
        setSuccess("No changes to save.");
        setSaving(false);
        return;
      }

      const data = await updateQueueConfig(updates);
      setConfig(data);
      setForm(
        Object.fromEntries(
          Object.entries(data).map(([k, v]) => [k, String(v)])
        )
      );
      setSuccess("Settings saved successfully.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    if (!confirm("Reset all queue settings to their defaults? This cannot be undone.")) return;
    setError("");
    setSuccess("");
    setResetting(true);

    try {
      const data = await resetQueueConfig();
      setConfig(data);
      setForm(
        Object.fromEntries(
          Object.entries(data).map(([k, v]) => [k, String(v)])
        )
      );
      setSuccess("Settings reset to defaults.");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to reset settings.");
    } finally {
      setResetting(false);
    }
  }

  function renderSection(title: string, fields: FieldDef[]) {
    return (
      <fieldset className="space-y-4">
        <legend className="text-base font-semibold text-gray-900">{title}</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          {fields.map((f) => (
            <div key={f.key}>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {f.label}
              </label>
              <input
                type="number"
                step="any"
                value={form[f.key] ?? ""}
                onChange={(e) => handleChange(f.key, e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <p className="mt-1 text-xs text-gray-400">{f.hint}</p>
            </div>
          ))}
        </div>
      </fieldset>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl py-10 text-center text-sm text-gray-500">
        Loading settings...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl py-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Queue Settings</h1>

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

      <form onSubmit={handleSave} className="space-y-8">
        {renderSection("Score Weights", SCORE_WEIGHTS)}
        {renderSection("Due Date", DUE_DATE_FIELDS)}
        {renderSection("Priority Values", PRIORITY_FIELDS)}

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="min-h-[44px] rounded-md bg-indigo-600 px-6 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>

          <button
            type="button"
            onClick={handleReset}
            disabled={resetting}
            className="min-h-[44px] rounded-md border border-gray-300 bg-white px-6 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
          >
            {resetting ? "Resetting..." : "Reset to Defaults"}
          </button>
        </div>
      </form>
    </div>
  );
}
