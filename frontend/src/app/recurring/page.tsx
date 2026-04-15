"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { RecurringTemplate } from "@/lib/types";
import { listRecurring } from "@/lib/api";
import { useProfile } from "@/lib/profile-context";

export default function RecurringPage() {
  const router = useRouter();
  const { activeProfile } = useProfile();
  const [templates, setTemplates] = useState<RecurringTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchTemplates = useCallback(() => {
    setLoading(true);
    setError("");
    listRecurring(activeProfile?.id)
      .then(setTemplates)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [activeProfile?.id]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Recurring Templates</h1>
        <Link
          href="/recurring/new"
          className="min-h-[44px] rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
        >
          New Template
        </Link>
      </div>

      {loading && <p className="text-sm text-gray-400">Loading...</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}

      {!loading && !error && templates.length === 0 && (
        <p className="text-sm text-gray-500">
          No recurring templates.{" "}
          <Link href="/recurring/new" className="text-indigo-600 hover:underline">
            Create one?
          </Link>
        </p>
      )}

      {!loading && templates.length > 0 && (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto rounded-lg border border-gray-200 sm:block">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Title
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Frequency
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Interval
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Active
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Next Fire
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {templates.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => router.push(`/recurring/${t.id}`)}
                    className="cursor-pointer transition-colors hover:bg-indigo-50"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {t.title}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                      {t.frequency}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                      Every {t.interval_count}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {t.active ? (
                        <span className="inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                          Active
                        </span>
                      ) : (
                        <span className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-500">
                      {t.next_fire
                        ? new Date(t.next_fire).toLocaleDateString()
                        : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 sm:hidden">
            {templates.map((t) => (
              <div
                key={t.id}
                onClick={() => router.push(`/recurring/${t.id}`)}
                className="cursor-pointer rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-colors hover:border-indigo-300"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium text-gray-900">{t.title}</div>
                  {t.active ? (
                    <span className="inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                      Active
                    </span>
                  ) : (
                    <span className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                      Inactive
                    </span>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-500">
                  <span>
                    Every {t.interval_count} {t.frequency}
                  </span>
                  {t.next_fire && (
                    <span>
                      Next: {new Date(t.next_fire).toLocaleDateString()}
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
