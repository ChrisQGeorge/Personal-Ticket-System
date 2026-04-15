"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { RecurringTemplate } from "@/lib/types";
import { getRecurring } from "@/lib/api";
import RecurringForm from "@/components/RecurringForm";

export default function EditRecurringPage() {
  const params = useParams();
  const id = Number(params.id);

  const [template, setTemplate] = useState<RecurringTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isNaN(id)) {
      setError("Invalid template ID");
      setLoading(false);
      return;
    }
    getRecurring(id)
      .then(setTemplate)
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Failed to load template")
      )
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <p className="text-sm text-gray-400">Loading template...</p>;
  }

  if (error) {
    return <p className="text-sm text-red-500">{error}</p>;
  }

  if (!template) {
    return <p className="text-sm text-gray-500">Template not found.</p>;
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">
        Edit Template: {template.title}
      </h1>
      <RecurringForm template={template} />
    </div>
  );
}
