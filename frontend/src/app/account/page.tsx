"use client";

import { useAuth } from "@/lib/auth-context";

export default function AccountPage() {
  const { user, isAdmin } = useAuth();

  if (!user) return null;

  return (
    <div className="mx-auto max-w-lg py-8">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Account</h1>

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <dl className="space-y-4">
          <div>
            <dt className="text-sm font-medium text-gray-500">Username</dt>
            <dd className="mt-1 text-sm text-gray-900">{user.username}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Role</dt>
            <dd className="mt-1">
              <span
                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  isAdmin
                    ? "bg-amber-100 text-amber-800"
                    : "bg-gray-100 text-gray-800"
                }`}
              >
                {user.role}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">Status</dt>
            <dd className="mt-1">
              <span
                className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  user.is_active
                    ? "bg-green-100 text-green-800"
                    : "bg-red-100 text-red-800"
                }`}
              >
                {user.is_active ? "Active" : "Inactive"}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-gray-500">
              Account Created
            </dt>
            <dd className="mt-1 text-sm text-gray-900">
              {new Date(user.created_at).toLocaleDateString(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
