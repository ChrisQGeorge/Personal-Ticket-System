"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Profile } from "@/lib/types";
import { listProfiles } from "@/lib/api";

export default function ProfilesPage() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    listProfiles()
      .then(setProfiles)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load profiles"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Profiles</h1>
        <Link
          href="/profiles/new"
          className="min-h-[44px] rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
        >
          Create Profile
        </Link>
      </div>

      {loading && <p className="text-sm text-gray-400">Loading...</p>}
      {error && <p className="text-sm text-red-500">{error}</p>}

      {!loading && !error && profiles.length === 0 && (
        <p className="text-sm text-gray-500">
          No profiles found.{" "}
          <Link href="/profiles/new" className="text-indigo-600 hover:underline">
            Create one?
          </Link>
        </p>
      )}

      {!loading && profiles.length > 0 && (
        <div className="space-y-3">
          {profiles.map((p) => (
            <div
              key={p.id}
              onClick={() => router.push(`/profiles/${p.id}`)}
              className="flex cursor-pointer items-center gap-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition-colors hover:border-indigo-300"
            >
              <div
                className="h-10 w-10 flex-shrink-0 rounded-full"
                style={{ backgroundColor: p.color }}
              />
              <div className="flex-1">
                <div className="font-medium text-gray-900">{p.name}</div>
                <div className="mt-0.5 flex flex-wrap gap-2 text-xs text-gray-500">
                  {p.email_enabled ? (
                    <span className="inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                      Email enabled
                    </span>
                  ) : (
                    <span className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                      Email off
                    </span>
                  )}
                  {p.imap_user && (
                    <span className="text-gray-400">{p.imap_user}</span>
                  )}
                </div>
              </div>
              <svg
                className="h-5 w-5 flex-shrink-0 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
