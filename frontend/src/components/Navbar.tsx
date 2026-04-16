"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useProfile } from "@/lib/profile-context";
import { useAuth } from "@/lib/auth-context";

interface NavLink {
  href: string;
  label: string;
  adminOnly?: boolean;
}

const links: NavLink[] = [
  { href: "/", label: "Home" },
  { href: "/tickets", label: "Tickets" },
  { href: "/queue", label: "Queue" },
  { href: "/recurring", label: "Recurring" },
  { href: "/import", label: "Import" },
  { href: "/backup", label: "Backup" },
  { href: "/config", label: "Settings", adminOnly: true },
  { href: "/admin/users", label: "Users", adminOnly: true },
];

export default function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { activeProfile } = useProfile();
  const { user, isAdmin, handleLogout } = useAuth();

  const visibleLinks = links.filter((l) => !l.adminOnly || isAdmin);

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <nav className="bg-indigo-700 text-white shadow-md">
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex h-14 items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-xl font-bold tracking-wide"
          >
            PTS
            {activeProfile && (
              <span className="flex items-center gap-1.5 rounded-full bg-indigo-800 px-2.5 py-0.5 text-xs font-medium text-indigo-100">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: activeProfile.color }}
                />
                {activeProfile.name}
              </span>
            )}
          </Link>

          {/* Desktop links */}
          <div className="hidden items-center gap-1 sm:flex">
            {visibleLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive(l.href)
                    ? "bg-indigo-900 text-white"
                    : "text-indigo-100 hover:bg-indigo-600"
                }`}
              >
                {l.label}
              </Link>
            ))}

            {/* User info + logout */}
            <div className="ml-3 flex items-center gap-2 border-l border-indigo-500 pl-3">
              <Link
                href="/account"
                className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-indigo-200 transition-colors hover:bg-indigo-600 hover:text-white"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
                {user?.username}
                {isAdmin && (
                  <span className="rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none text-white">
                    Admin
                  </span>
                )}
              </Link>
              <button
                onClick={handleLogout}
                className="min-h-[44px] min-w-[44px] rounded-md px-3 py-2 text-sm font-medium text-indigo-200 transition-colors hover:bg-indigo-600 hover:text-white"
              >
                Logout
              </button>
            </div>
          </div>

          {/* Mobile hamburger */}
          <button
            className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md hover:bg-indigo-600 sm:hidden"
            onClick={() => setOpen(!open)}
            aria-label="Toggle navigation"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              {open ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="border-t border-indigo-600 pb-3 sm:hidden">
          {visibleLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className={`block min-h-[44px] px-4 py-3 text-sm font-medium ${
                isActive(l.href)
                  ? "bg-indigo-900 text-white"
                  : "text-indigo-100 hover:bg-indigo-600"
              }`}
            >
              {l.label}
            </Link>
          ))}

          {/* Mobile user info */}
          <div className="mt-2 border-t border-indigo-600 pt-2">
            <Link
              href="/account"
              onClick={() => setOpen(false)}
              className="flex min-h-[44px] items-center gap-2 px-4 py-3 text-sm font-medium text-indigo-100 hover:bg-indigo-600"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
              {user?.username}
              {isAdmin && (
                <span className="rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none text-white">
                  Admin
                </span>
              )}
            </Link>
            <button
              onClick={() => {
                setOpen(false);
                handleLogout();
              }}
              className="block min-h-[44px] w-full px-4 py-3 text-left text-sm font-medium text-indigo-100 hover:bg-indigo-600"
            >
              Logout
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
