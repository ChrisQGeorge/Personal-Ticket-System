"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  RecurringTemplate,
  RecurringTemplateCreate,
  RecurringTemplateUpdate,
  Priority,
  Frequency,
} from "@/lib/types";
import { createRecurring, updateRecurring, deleteRecurring } from "@/lib/api";

const PRIORITIES: Priority[] = ["very low", "low", "default", "high", "very high"];
const FREQUENCIES: Frequency[] = ["daily", "weekly", "monthly"];

interface Props {
  template?: RecurringTemplate;
}

export default function RecurringForm({ template }: Props) {
  const router = useRouter();
  const isEdit = !!template;

  const [title, setTitle] = useState(template?.title ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const [priority, setPriority] = useState<Priority>(template?.priority ?? "default");
  const [estHours, setEstHours] = useState(template?.est_hours?.toString() ?? "");
  const [active, setActive] = useState(template?.active ?? true);
  const [frequency, setFrequency] = useState<Frequency>(template?.frequency ?? "weekly");
  const [intervalCount, setIntervalCount] = useState(
    template?.interval_count?.toString() ?? "1"
  );
  const [startDate, setStartDate] = useState(template?.start_date ?? "");

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const freqLabel =
    frequency === "daily" ? "day(s)" : frequency === "weekly" ? "week(s)" : "month(s)";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    if (!startDate) {
      setError("Start date is required.");
      return;
    }
    setError("");
    setSaving(true);

    try {
      if (isEdit) {
        const data: RecurringTemplateUpdate = {
          title: title.trim(),
          description: description.trim() || undefined,
          priority,
          est_hours: estHours ? parseFloat(estHours) : undefined,
          active,
          frequency,
          interval_count: parseInt(intervalCount) || 1,
          start_date: startDate,
        };
        await updateRecurring(template!.id, data);
      } else {
        const data: RecurringTemplateCreate = {
          title: title.trim(),
          description: description.trim() || undefined,
          priority,
          est_hours: estHours ? parseFloat(estHours) : undefined,
          active,
          frequency,
          interval_count: parseInt(intervalCount) || 1,
          start_date: startDate,
        };
        await createRecurring(data);
      }
      router.push("/recurring");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save template.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this recurring template?")) return;
    setDeleting(true);
    try {
      await deleteRecurring(template!.id);
      router.push("/recurring");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete template.");
      setDeleting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-5">
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Title */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Title <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      {/* Description */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Description
        </label>
        <textarea
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Priority */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Priority
          </label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as Priority)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p.charAt(0).toUpperCase() + p.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {/* Est Hours */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Est. Hours
          </label>
          <input
            type="number"
            min="0"
            step="0.25"
            value={estHours}
            onChange={(e) => setEstHours(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* Frequency */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Frequency
          </label>
          <select
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as Frequency)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {FREQUENCIES.map((f) => (
              <option key={f} value={f}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {/* Interval Count */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Every N {freqLabel}
          </label>
          <input
            type="number"
            min="1"
            value={intervalCount}
            onChange={(e) => setIntervalCount(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* Start Date */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Start Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* Active */}
        <div className="flex items-end pb-1">
          <label className="flex min-h-[44px] items-center gap-2 text-sm font-medium text-gray-700">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            Active
          </label>
        </div>
      </div>

      {/* Read-only info for edit */}
      {isEdit && (
        <div className="grid gap-4 rounded-md bg-gray-50 p-4 text-sm text-gray-600 sm:grid-cols-2">
          <div>
            <span className="font-medium">ID:</span> {template!.id}
          </div>
          <div>
            <span className="font-medium">Last Fired:</span>{" "}
            {template!.last_fired
              ? new Date(template!.last_fired).toLocaleString()
              : "Never"}
          </div>
          <div>
            <span className="font-medium">Next Fire:</span>{" "}
            {template!.next_fire
              ? new Date(template!.next_fire).toLocaleString()
              : "N/A"}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={saving}
          className="min-h-[44px] rounded-md bg-indigo-600 px-6 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : isEdit ? "Update Template" : "Create Template"}
        </button>

        <button
          type="button"
          onClick={() => router.push("/recurring")}
          className="min-h-[44px] rounded-md border border-gray-300 bg-white px-6 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
        >
          Cancel
        </button>

        {isEdit && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="min-h-[44px] rounded-md bg-red-600 px-6 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 disabled:opacity-50 sm:ml-auto"
          >
            {deleting ? "Deleting..." : "Delete"}
          </button>
        )}
      </div>
    </form>
  );
}
