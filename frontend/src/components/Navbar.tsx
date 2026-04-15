"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useProfile } from "@/lib/profile-context";

const links = [
  { href: "/", label: "Home" },
  { href: "/tickets", label: "Tickets" },
  { href: "/queue", label: "Queue" },
  { href: "/recurring", label: "Recurring" },
  { href: "/import", label: "Import" },
  { href: "/backup", label: "Backup" },
  { href: "/config", label: "Settings" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { activeProfile } = useProfile();

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <nav className="bg-indigo-700 text-white shadow-md">
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex h-14 items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-xl font-bold tracking-wide">
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
          <div className="hidden gap-1 sm:flex">
            {links.map((l) => (
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
          {links.map((l) => (
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
        </div>
      )}
    </nav>
  );
}
