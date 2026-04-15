"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Ticket } from "@/lib/types";
import { getTicket } from "@/lib/api";
import TicketForm from "@/components/TicketForm";

export default function EditTicketPage() {
  const params = useParams();
  const id = Number(params.id);

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isNaN(id)) {
      setError("Invalid ticket ID");
      setLoading(false);
      return;
    }
    getTicket(id)
      .then(setTicket)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load ticket"))
      .finally(() => setLoading(false));
  }, [id]);

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
      <h1 className="text-2xl font-bold text-gray-900">
        Edit Ticket #{ticket.id}
      </h1>
      <TicketForm ticket={ticket} />
    </div>
  );
}
