"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { useProfile } from "@/lib/profile-context";
import { useAuth } from "@/lib/auth-context";
import { GameStats } from "@/lib/types";
import { getGameStats } from "@/lib/api";

interface NavLink {
  href: string;
  label: string;
}

// Primary nav — daily-use items
const primaryLinks: NavLink[] = [
  { href: "/", label: "Home" },
  { href: "/tickets", label: "Tickets" },
  { href: "/queue", label: "Queue" },
  { href: "/recurring", label: "Recurring" },
];

// "More" dropdown — less frequent items
const moreLinks: NavLink[] = [
  { href: "/import", label: "Import Tickets" },
  { href: "/backup", label: "Backup & Restore" },
];

// Admin-only dropdown
const adminLinks: NavLink[] = [
  { href: "/config", label: "Queue Settings" },
  { href: "/admin/users", label: "Manage Users" },
];

interface DropdownProps {
  label: string;
  links: NavLink[];
  isActive: (href: string) => boolean;
}

function NavDropdown({ label, links, isActive }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const anyActive = links.some((l) => isActive(l.href));

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
          anyActive || open
            ? "bg-indigo-900 text-white"
            : "text-indigo-100 hover:bg-indigo-600"
        }`}
      >
        {label}
        <svg
          className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2.5}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-52 rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className={`block px-4 py-2 text-sm transition-colors ${
                isActive(l.href)
                  ? "bg-indigo-50 font-medium text-indigo-700"
                  : "text-gray-700 hover:bg-gray-50"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { activeProfile } = useProfile();
  const { user, isAdmin, handleLogout } = useAuth();
  const [gameStats, setGameStats] = useState<GameStats | null>(null);

  useEffect(() => {
    getGameStats()
      .then(setGameStats)
      .catch(() => {});
  }, [pathname]);

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

          {/* Desktop nav */}
          <div className="hidden items-center gap-1 sm:flex">
            {primaryLinks.map((l) => (
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

            {/* Quest link (always shown; dashboard works even when disabled) */}
            <Link
              href="/gamification"
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive("/gamification")
                  ? "bg-indigo-900 text-white"
                  : "text-indigo-100 hover:bg-indigo-600"
              }`}
            >
              Quest
            </Link>

            {/* More dropdown */}
            <NavDropdown label="More" links={moreLinks} isActive={isActive} />

            {/* Admin dropdown */}
            {isAdmin && (
              <NavDropdown label="Admin" links={adminLinks} isActive={isActive} />
            )}

            {/* Game stats badge */}
            {gameStats?.gamification_enabled && (
              <Link
                href="/gamification"
                className="flex items-center gap-1.5 rounded-full bg-indigo-800/60 px-2.5 py-1 text-xs font-medium text-amber-300 transition-colors hover:bg-indigo-800"
              >
                <span className="font-bold">Lv.{gameStats.current_level}</span>
                <span className="text-indigo-300">|</span>
                <span>{gameStats.total_xp.toLocaleString()} XP</span>
              </Link>
            )}

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
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle navigation"
          >
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              {mobileOpen ? (
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
      {mobileOpen && (
        <div className="border-t border-indigo-600 pb-3 sm:hidden">
          {[...primaryLinks, { href: "/gamification", label: "Quest" }].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setMobileOpen(false)}
              className={`block min-h-[44px] px-4 py-3 text-sm font-medium ${
                isActive(l.href)
                  ? "bg-indigo-900 text-white"
                  : "text-indigo-100 hover:bg-indigo-600"
              }`}
            >
              {l.label}
              {l.href === "/gamification" && gameStats?.gamification_enabled && (
                <span className="ml-2 text-xs text-amber-300">
                  Lv.{gameStats.current_level}
                </span>
              )}
            </Link>
          ))}

          <div className="mt-1 border-t border-indigo-600 pt-1">
            <div className="px-4 py-1 text-[10px] font-bold uppercase tracking-wider text-indigo-300">
              More
            </div>
            {moreLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMobileOpen(false)}
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

          {isAdmin && (
            <div className="mt-1 border-t border-indigo-600 pt-1">
              <div className="px-4 py-1 text-[10px] font-bold uppercase tracking-wider text-indigo-300">
                Admin
              </div>
              {adminLinks.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setMobileOpen(false)}
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

          {/* Mobile user info */}
          <div className="mt-2 border-t border-indigo-600 pt-2">
            <Link
              href="/account"
              onClick={() => setMobileOpen(false)}
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
                setMobileOpen(false);
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
