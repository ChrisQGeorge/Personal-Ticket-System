"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ticket, TicketCreate, TicketUpdate, Priority, TicketStatus, GameEvent, CustomAttribute } from "@/lib/types";
import { createTicket, updateTicket, deleteTicket } from "@/lib/api";
import { useProfile } from "@/lib/profile-context";
import GameEventToast from "@/components/GameEventToast";
import CustomAttributesEditor from "@/components/CustomAttributesEditor";

const PRIORITIES: Priority[] = ["very low", "low", "default", "high", "very high"];
const STATUSES: TicketStatus[] = ["open", "in-progress", "completed", "skipped"];

interface Props {
  ticket?: Ticket;
}

export default function TicketForm({ ticket }: Props) {
  const router = useRouter();
  const { activeProfile } = useProfile();
  const isEdit = !!ticket;

  const [title, setTitle] = useState(ticket?.title ?? "");
  const [description, setDescription] = useState(ticket?.description ?? "");
  const [priority, setPriority] = useState<Priority>(ticket?.priority ?? "default");
  const [status, setStatus] = useState<TicketStatus>(ticket?.status ?? "open");
  const [dueDate, setDueDate] = useState(ticket?.due_date ?? "");
  const [estHours, setEstHours] = useState(ticket?.est_hours?.toString() ?? "");
  const [customAttributes, setCustomAttributes] = useState<CustomAttribute[]>(
    ticket?.custom_attributes ?? []
  );
  const [relatedIds, setRelatedIds] = useState(
    ticket?.related_ticket_ids?.join(", ") ?? ""
  );

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const [gameEvent, setGameEvent] = useState<GameEvent | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    setError("");
    setSaving(true);

    const related = relatedIds
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map(Number)
      .filter((n) => !isNaN(n));

    try {
      if (isEdit) {
        // On edit, send null for cleared fields so backend knows to clear them
        const data: TicketUpdate = {
          title: title.trim(),
          description: description.trim() || null,
          priority,
          status,
          due_date: dueDate || null,
          est_hours: estHours ? parseFloat(estHours) : null,
          related_ticket_ids: related,
          custom_attributes: customAttributes,
        };
        await updateTicket(ticket!.id, data);
      } else {
        const data: TicketCreate = {
          title: title.trim(),
          description: description.trim() || undefined,
          priority,
          due_date: dueDate || undefined,
          est_hours: estHours ? parseFloat(estHours) : undefined,
          related_ticket_ids: related.length > 0 ? related : undefined,
          profile_id: activeProfile?.id,
          custom_attributes: customAttributes,
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result: any = await createTicket(data);
        if (result?.game_event) {
          setGameEvent(result.game_event as GameEvent);
          // Brief delay to show XP toast before redirecting
          setTimeout(() => router.push("/tickets"), 1500);
          return;
        }
      }
      router.push("/tickets");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save ticket.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this ticket?")) return;
    setDeleting(true);
    try {
      await deleteTicket(ticket!.id);
      router.push("/tickets");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete ticket.");
      setDeleting(false);
    }
  }

  return (
    <>
    <GameEventToast event={gameEvent} onDismiss={() => setGameEvent(null)} />
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
          rows={5}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          placeholder="Supports markdown"
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

        {/* Status (edit only) */}
        {isEdit ? (
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as TicketStatus)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Status
            </label>
            <input
              type="text"
              value="open"
              disabled
              className="w-full rounded-md border border-gray-200 bg-gray-100 px-3 py-2 text-sm text-gray-500"
            />
          </div>
        )}

        {/* Due Date */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Due Date
          </label>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
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
      </div>

      {/* Related Tickets */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">
          Related Ticket IDs{" "}
          <span className="text-xs text-gray-400">(comma-separated)</span>
        </label>
        <input
          type="text"
          value={relatedIds}
          onChange={(e) => setRelatedIds(e.target.value)}
          placeholder="e.g. 1, 5, 12"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>

      {/* Custom Attributes */}
      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">
          Custom Attributes
        </label>
        <CustomAttributesEditor
          attributes={customAttributes}
          onChange={setCustomAttributes}
          showCurrent={true}
        />
      </div>

      {/* Read-only info for edit */}
      {isEdit && (
        <div className="grid gap-4 rounded-md bg-gray-50 p-4 text-sm text-gray-600 sm:grid-cols-3">
          <div>
            <span className="font-medium">ID:</span> {ticket!.id}
          </div>
          <div>
            <span className="font-medium">Created:</span>{" "}
            {new Date(ticket!.date_created).toLocaleString()}
          </div>
          <div>
            <span className="font-medium">Skip Count:</span> {ticket!.skip_count}
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
          {saving ? "Saving..." : isEdit ? "Update Ticket" : "Create Ticket"}
        </button>

        <button
          type="button"
          onClick={() => router.push("/tickets")}
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
    </>
  );
}
