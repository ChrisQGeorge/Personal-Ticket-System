"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Ticket } from "@/lib/types";
import { getTicket, listTickets } from "@/lib/api";
import { useProfile } from "@/lib/profile-context";
import TicketForm from "@/components/TicketForm";

export default function EditTicketPage() {
  const params = useParams();
  const id = Number(params.id);
  const { activeProfile } = useProfile();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [prevId, setPrevId] = useState<number | null>(null);
  const [nextId, setNextId] = useState<number | null>(null);
  const [position, setPosition] = useState<{ index: number; total: number } | null>(
    null
  );

  useEffect(() => {
    if (isNaN(id)) {
      setError("Invalid ticket ID");
      setLoading(false);
      return;
    }
    setLoading(true);
    getTicket(id)
      .then(setTicket)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load ticket"))
      .finally(() => setLoading(false));
  }, [id]);

  // Load sibling tickets for prev/next navigation
  useEffect(() => {
    if (!ticket) return;
    // Fetch tickets in the same profile sorted by ID (creation order)
    listTickets({
      profile_id: ticket.profile_id ?? activeProfile?.id,
      sort_by: "id",
      sort_order: "asc",
    })
      .then((tickets) => {
        const idx = tickets.findIndex((t) => t.id === ticket.id);
        if (idx === -1) {
          setPrevId(null);
          setNextId(null);
          setPosition(null);
          return;
        }
        setPosition({ index: idx + 1, total: tickets.length });
        setPrevId(idx > 0 ? tickets[idx - 1].id : null);
        setNextId(idx < tickets.length - 1 ? tickets[idx + 1].id : null);
      })
      .catch(() => {
        setPrevId(null);
        setNextId(null);
      });
  }, [ticket, activeProfile?.id]);

  if (loading) {
    return <p className="text-sm text-gray-400">Loading ticket...</p>;
  }

  if (error) {
    return <p className="text-sm text-red-500">{error}</p>;
  }

  if (!ticket) {
    return <p className="text-sm text-gray-500">Ticket not found.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link
            href="/tickets"
            className="text-sm text-indigo-600 hover:text-indigo-700 hover:underline"
          >
            &larr; Back to list
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">
            Edit Ticket #{ticket.id}
          </h1>
        </div>

        {/* Prev/Next navigation */}
        <div className="flex items-center gap-1">
          {prevId != null ? (
            <Link
              href={`/tickets/${prevId}`}
              title={`Previous ticket (#${prevId})`}
              className="inline-flex min-h-[36px] items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Prev
            </Link>
          ) : (
            <span className="inline-flex min-h-[36px] items-center gap-1 rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-300">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Prev
            </span>
          )}

          {position && (
            <span className="min-w-[60px] px-2 text-center text-xs text-gray-500">
              {position.index} of {position.total}
            </span>
          )}

          {nextId != null ? (
            <Link
              href={`/tickets/${nextId}`}
              title={`Next ticket (#${nextId})`}
              className="inline-flex min-h-[36px] items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
            >
              Next
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          ) : (
            <span className="inline-flex min-h-[36px] items-center gap-1 rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-gray-300">
              Next
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </span>
          )}
        </div>
      </div>

      <TicketForm ticket={ticket} />
    </div>
  );
}
