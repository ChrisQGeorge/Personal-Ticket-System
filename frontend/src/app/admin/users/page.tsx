"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { User } from "@/lib/types";
import {
  listUsers,
  updateUserRole,
  updateUserActive,
  deleteUser,
} from "@/lib/api";

export default function AdminUsersPage() {
  const { user: currentUser, isAdmin } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    if (!isAdmin) return;
    loadUsers();
  }, [isAdmin]);

  async function loadUsers() {
    setLoading(true);
    setError("");
    try {
      const data = await listUsers();
      setUsers(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load users.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRoleChange(userId: number, role: string) {
    setActionError("");
    try {
      const updated = await updateUserRole(userId, role);
      setUsers((prev) => prev.map((u) => (u.id === userId ? updated : u)));
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : "Failed to update role."
      );
    }
  }

  async function handleActiveToggle(userId: number, currentActive: boolean) {
    setActionError("");
    try {
      const updated = await updateUserActive(userId, !currentActive);
      setUsers((prev) => prev.map((u) => (u.id === userId ? updated : u)));
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : "Failed to update status."
      );
    }
  }

  async function handleDelete(userId: number, username: string) {
    if (
      !confirm(
        `Are you sure you want to delete user "${username}"? This cannot be undone.`
      )
    )
      return;
    setActionError("");
    try {
      await deleteUser(userId);
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch (err: unknown) {
      setActionError(
        err instanceof Error ? err.message : "Failed to delete user."
      );
    }
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-2xl py-8">
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-700">
          Access denied. This page is only available to administrators.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl py-8">
      <h1 className="mb-2 text-2xl font-bold text-gray-900">
        User Management
      </h1>
      <p className="mb-6 text-sm text-gray-500">
        Manage user accounts, roles, and access. Admin-only page.
      </p>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {actionError && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">
          {actionError}
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-sm text-gray-500">
          Loading users...
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">
                  ID
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">
                  Username
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">
                  Role
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">
                  Active
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">
                  Created
                </th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u) => {
                const isSelf = u.id === currentUser?.id;
                return (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-500">{u.id}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {u.username}
                      {isSelf && (
                        <span className="ml-2 text-xs text-gray-400">
                          (you)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isSelf ? (
                        <span className="inline-flex rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-medium text-indigo-800">
                          {u.role}
                        </span>
                      ) : (
                        <select
                          value={u.role}
                          onChange={(e) =>
                            handleRoleChange(u.id, e.target.value)
                          }
                          className="min-h-[36px] rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                          <option value="user">user</option>
                          <option value="admin">admin</option>
                        </select>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {isSelf ? (
                        <span className="inline-flex rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                          Active
                        </span>
                      ) : (
                        <button
                          onClick={() =>
                            handleActiveToggle(u.id, u.is_active)
                          }
                          className={`min-h-[36px] min-w-[44px] rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                            u.is_active
                              ? "bg-green-100 text-green-800 hover:bg-green-200"
                              : "bg-red-100 text-red-800 hover:bg-red-200"
                          }`}
                        >
                          {u.is_active ? "Active" : "Inactive"}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!isSelf && (
                        <button
                          onClick={() => handleDelete(u.id, u.username)}
                          className="min-h-[36px] rounded-md px-3 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
