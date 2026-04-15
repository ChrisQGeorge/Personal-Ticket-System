"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { Ticket, TicketStatus, Priority } from "@/lib/types";
import { listTickets } from "@/lib/api";

const STATUS_OPTIONS: (TicketStatus | "")[] = ["", "open", "in-progress", "completed", "skipped"];
const PRIORITY_OPTIONS: (Priority | "")[] = ["", "very low", "low", "default", "high", "very high"];

type SortField = "id" | "title" | "status" | "priority" | "due_date" | "est_hours";

const PRIORITY_ORDER: Record<string, number> = {
  "very low": 0,
  low: 1,
  default: 2,
  high: 3,
  "very high": 4,
};

export default function TicketsPage() {
  const router = useRouter();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [statusFilter, setStatusFilter] = useState<string>("");
  const [priorityFilter, setPriorityFilter] = useState<string>("");
  const [sortField, setSortField] = useState<SortField>("id");
  const [sortAsc, setSortAsc] = useState(true);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listTickets({
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
      });
      setTickets(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load tickets");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, priorityFilter]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  }

  const sorted = [...tickets].sort((a, b) => {
    let cmp = 0;
    const fa = sortField;
    if (fa === "priority") {
      cmp = (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2);
    } else if (fa === "est_hours") {
      cmp = (a.est_hours ?? 0) - (b.est_hours ?? 0);
    } else if (fa === "due_date") {
      const da = a.due_date ?? "";
      const db = b.due_date ?? "";
      cmp = da.localeCompare(db);
    } else if (fa === "id") {
      cmp = a.id - b.id;
    } else {
      const va = String((a as unknown as Record<string, unknown>)[fa] ?? "");
      const vb = String((b as unknown as Record<string, unknown>)[fa] ?? "");
      cmp = va.localeCompare(vb);
    }
    return sortAsc ? cmp : -cmp;
  });

  function sortIcon(field: SortField) {
    if (sortField !== field) return "";
    return sortAsc ? " \u25B2" : " \u25BC";
  }

  function priorityBadge(p: Priority) {
    const colors: Record<string, string> = {
      "very low": "bg-gray-100 text-gray-600",
      low: "bg-blue-100 text-blue-700",
      default: "bg-gray-200 text-gray-700",
      high: "bg-orange-100 text-orange-700",
      "very high": "bg-red-100 text-red-700",
    };
    return (
      <span
        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${colors[p] ?? ""}`}
      >
        {p}
      </span>
    );
  }

  function statusBadge(s: TicketStatus) {
    const colors: Record<string, string> = {
      open: "bg-blue-100 text-blue-700",
      "in-progress": "bg-yellow-100 text-yellow-700",
      completed: "bg-green-100 text-green-700",
      skipped: "bg-gray-100 text-gray-600",
    };
    return (
      <span
        className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${colors[s] ?? ""}`}
      >
        {s}
      </span>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Tickets</h1>
        <Link
          href="/tickets/new"
          className="min-h-[44px] rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
        >
          New Ticket
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.filter(Boolean).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">All Priorities</option>
          {PRIORITY_OPTIONS.filter(Boolean).map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      {loading && <p className="text-sm text-gray-400">Loading...</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}

      {!loading && !error && tickets.length === 0 && (
        <p className="text-sm text-gray-500">
          No tickets found.{" "}
          <Link href="/tickets/new" className="text-indigo-600 hover:underline">
            Create one?
          </Link>
        </p>
      )}

      {!loading && sorted.length > 0 && (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto rounded-lg border border-gray-200 sm:block">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {(
                    [
                      ["id", "ID"],
                      ["title", "Title"],
                      ["status", "Status"],
                      ["priority", "Priority"],
                      ["due_date", "Due Date"],
                      ["est_hours", "Est Hrs"],
                    ] as [SortField, string][]
                  ).map(([field, label]) => (
                    <th
                      key={field}
                      onClick={() => handleSort(field)}
                      className="cursor-pointer select-none whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 hover:text-gray-700"
                    >
                      {label}
                      {sortIcon(field)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {sorted.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => router.push(`/tickets/${t.id}`)}
                    className="cursor-pointer transition-colors hover:bg-indigo-50"
                  >
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-gray-700">
                      #{t.id}
                    </td>
                    <td className="px-4 py-3 text-gray-900">{t.title}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {statusBadge(t.status)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {priorityBadge(t.priority)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-500">
                      {t.due_date ?? "-"}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-500">
                      {t.est_hours != null ? t.est_hours : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 sm:hidden">
            {sorted.map((t) => (
              <div
                key={t.id}
                onClick={() => router.push(`/tickets/${t.id}`)}
                className="cursor-pointer rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-colors hover:border-indigo-300"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium text-gray-900">
                    <span className="mr-1 text-gray-400">#{t.id}</span>
                    {t.title}
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  {statusBadge(t.status)}
                  {priorityBadge(t.priority)}
                  {t.due_date && (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">
                      Due: {t.due_date}
                    </span>
                  )}
                  {t.est_hours != null && (
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-600">
                      {t.est_hours}h
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
