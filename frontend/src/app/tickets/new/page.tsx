"use client";

import TicketForm from "@/components/TicketForm";

export default function NewTicketPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">New Ticket</h1>
      <TicketForm />
    </div>
  );
}
